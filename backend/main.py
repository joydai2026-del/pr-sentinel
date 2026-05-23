"""
PR Sentinel - FastAPI backend.

Endpoints:
  GET  /healthz           liveness probe
  POST /review/sync       synchronous 4-lens review (the demo path)
  POST /webhook           GitHub App webhook (verified HMAC, returns 501 until App is wired)
  GET  /runs/{run_id}     fetch a stored run
"""

import hashlib
import hmac
import logging
import os
import time
import uuid
from collections import OrderedDict, deque
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from aggregator import build_review_result
from reviewers import all_lenses_failed, run_all_lenses
from storage import get_backend, get_run, save_run

log = logging.getLogger("pr_sentinel")

# Max diff size on /review/sync. Pydantic's max_length counts characters, so we use a
# char-based bound. 100 KB-equivalent ASCII keeps a worst-case 4-lens Sonnet call well
# under $0.50.
MAX_DIFF_CHARS = int(os.environ.get("MAX_DIFF_CHARS", 100_000))

# Rate limit: per-IP requests within a sliding window. In-memory only, so it resets per
# container; for multi-container scale, swap for Redis or Cloudflare. Documented in README.
RATE_LIMIT_PER_HOUR = int(os.environ.get("RATE_LIMIT_PER_HOUR", 20))
_MAX_RATE_LIMIT_BUCKETS = int(os.environ.get("MAX_RATE_LIMIT_BUCKETS", 5_000))
_request_log: OrderedDict[str, deque[float]] = OrderedDict()

# Trusted proxy whitelist for X-Forwarded-For parsing. If empty, we ignore the header
# and use request.client.host (safe default — Modal puts a proxy in front so you SHOULD
# set this to its egress IPs once you have them; before then, every Modal request looks
# like it comes from the same IP, which is fine for V0.1 rate-limit purposes).
TRUSTED_PROXIES = {
    ip.strip() for ip in os.environ.get("TRUSTED_PROXIES", "").split(",") if ip.strip()
}

API_KEY = os.environ.get("PR_SENTINEL_API_KEY", "").strip()
GITHUB_WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "").strip()

_default_origins = "http://localhost:3000"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]


app = FastAPI(
    title="PR Sentinel",
    description="Multi-lens AI code review. 4 perspectives, 1 verdict.",
    version="0.1.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key", "X-Hub-Signature-256", "X-GitHub-Event"],
)


# Request/Response models

class ReviewRequest(BaseModel):
    diff: str = Field(..., min_length=1, max_length=MAX_DIFF_CHARS)
    pr_title: str = Field("", max_length=500)
    pr_body: str = Field("", max_length=8_000)
    pr_url: str = Field("", max_length=500)


class ReviewResponse(BaseModel):
    verdict: str
    total_must_fixes: int
    lenses: dict[str, Any]
    run_id: str
    storage_backend: str


# Auth + rate limit

def _client_ip(request: Request) -> str:
    """Resolve the client IP, only trusting X-Forwarded-For from configured proxies.

    Without this, anyone can rotate X-Forwarded-For to bypass the per-IP rate limit and
    fill _request_log with unique entries (memory DoS). The default is the safe one:
    use request.client.host until TRUSTED_PROXIES is configured.
    """
    direct = request.client.host if request.client else "unknown"
    if TRUSTED_PROXIES and direct in TRUSTED_PROXIES:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip() or direct
    return direct


def _enforce_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - 3600
    bucket = _request_log.get(ip)
    if bucket is None:
        bucket = deque()
        _request_log[ip] = bucket
        # Cap the bucket dict to keep memory bounded under IP churn.
        while len(_request_log) > _MAX_RATE_LIMIT_BUCKETS:
            _request_log.popitem(last=False)
    else:
        _request_log.move_to_end(ip)
    while bucket and bucket[0] < window_start:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {RATE_LIMIT_PER_HOUR}/hour per IP",
        )
    bucket.append(now)


def _require_api_key(presented: str | None) -> None:
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="PR_SENTINEL_API_KEY is not configured on the server",
        )
    if not presented or not hmac.compare_digest(API_KEY, presented):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


# Routes

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": "0.1.1"}


@app.post("/review/sync", response_model=ReviewResponse)
async def review_sync(
    req: ReviewRequest,
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    _require_api_key(x_api_key)
    _enforce_rate_limit(_client_ip(request))

    if not req.diff.strip():
        raise HTTPException(status_code=400, detail="diff cannot be empty")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not set. Cannot run reviews.",
        )

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    await save_run(
        run_id=run_id,
        pr_url=req.pr_url or "",
        status="running",
        verdict=None,
        lenses=None,
        started_at=started_at,
    )

    lenses = await run_all_lenses(
        diff=req.diff,
        pr_title=req.pr_title,
        pr_body=req.pr_body,
    )

    finished_at = datetime.now(timezone.utc)

    if all_lenses_failed(lenses):
        # No lens actually returned a verdict; pretending this is a real review
        # ("NEEDS-FIXES across the board") would be a fantasy result. Surface the
        # failure to the caller.
        await save_run(
            run_id=run_id,
            pr_url=req.pr_url or "",
            status="failed",
            verdict=None,
            lenses={"errors": [lens for lens in lenses.values()]},
            started_at=started_at,
            finished_at=finished_at,
        )
        raise HTTPException(
            status_code=502,
            detail="All 4 review lenses failed. The model is unavailable or misconfigured.",
        )

    result = build_review_result(lenses, run_id)

    await save_run(
        run_id=run_id,
        pr_url=req.pr_url or "",
        status="complete",
        verdict=result["verdict"],
        lenses=result["lenses"],
        started_at=started_at,
        finished_at=finished_at,
    )

    return ReviewResponse(
        verdict=result["verdict"],
        total_must_fixes=result["total_must_fixes"],
        lenses=result["lenses"],
        run_id=run_id,
        storage_backend=get_backend(),
    )


@app.get("/runs/{run_id}")
async def get_run_endpoint(
    run_id: str,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    _require_api_key(x_api_key)
    row = await get_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@app.post("/webhook")
async def webhook(request: Request):
    """
    GitHub App webhook receiver.
    Verifies HMAC signature against GITHUB_WEBHOOK_SECRET. The PR-handling pipeline
    (event parsing -> /review/sync -> GitHub check run posting) is V0.2 and currently
    returns 501. We still verify the signature so unauthenticated traffic is rejected
    before any logic runs.
    """
    if not GITHUB_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="GITHUB_WEBHOOK_SECRET not configured. Webhook disabled.",
        )

    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    raise HTTPException(
        status_code=501,
        detail="GitHub App pipeline is V0.2. See docs/install-github-app.md.",
    )
