"""
PR Sentinel — FastAPI backend.

Endpoints:
  GET  /healthz           — liveness probe
  POST /review/sync       — synchronous 4-lens review (the demo path)
  POST /webhook           — GitHub App webhook stub (V0.2)
  GET  /runs/{run_id}     — fetch a stored run
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from aggregator import build_review_result
from reviewers import run_all_lenses
from storage import get_backend, get_run, save_run

app = FastAPI(
    title="PR Sentinel",
    description="Multi-lens AI code review. 4 perspectives, 1 verdict.",
    version="0.1.0",
)

# CORS — allow all origins for MVP demo (lock down in V0.2)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ──────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    diff: str
    pr_title: str = ""
    pr_body: str = ""
    pr_url: str = ""


class ReviewResponse(BaseModel):
    verdict: str
    total_must_fixes: int
    lenses: dict[str, Any]
    run_id: str
    storage_backend: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "version": "0.1.0",
        "storage": get_backend(),
        "anthropic_key_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }


@app.post("/review/sync", response_model=ReviewResponse)
async def review_sync(req: ReviewRequest):
    if not req.diff.strip():
        raise HTTPException(status_code=400, detail="diff cannot be empty")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not set. Cannot run reviews.",
        )

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    # Persist "running" state
    save_run(
        run_id=run_id,
        pr_url=req.pr_url or "",
        status="running",
        verdict=None,
        lenses=None,
        started_at=started_at,
    )

    # Run all 4 lenses in parallel
    lenses = await run_all_lenses(
        diff=req.diff,
        pr_title=req.pr_title,
        pr_body=req.pr_body,
    )

    finished_at = datetime.now(timezone.utc)
    result = build_review_result(lenses, run_id)

    # Persist final state
    save_run(
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
async def get_run_endpoint(run_id: str):
    row = get_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@app.post("/webhook")
async def webhook(request: Request):
    """
    GitHub App webhook stub — V0.2.
    Will: verify HMAC signature, parse PR opened/synchronize events,
    call /review/sync, post GitHub check run result.
    """
    payload = await request.json()
    event = request.headers.get("X-GitHub-Event", "unknown")
    return {
        "status": "webhook_received",
        "event": event,
        "note": "Full webhook handling ships in V0.2. See docs/install-github-app.md.",
        "payload_keys": list(payload.keys()) if isinstance(payload, dict) else [],
    }
