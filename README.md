# PR Sentinel

**Multi-lens AI code review for GitHub pull requests.**

PR Sentinel runs 4 independent AI reviewers in parallel on every diff: a code quality reviewer, a security engineer, a reality checker, and an adversarial attacker. It collapses their verdicts into one result (PASS / NEEDS-FIXES / BLOCK). Where competitors run one model from one angle, Sentinel runs four, in the same time it takes to run one.

> **Status**: V0.1 ships the synchronous review API (`POST /review/sync`) plus the demo UI. The full GitHub App pipeline (webhook delivery, PR-comment posting, Check Run creation) is V0.2; the `/webhook` endpoint verifies HMAC signatures and currently returns 501 for everything downstream. See `docs/install-github-app.md`.

---

## Quickstart (local demo)

1. Clone and install:
   ```bash
   git clone https://github.com/joydai2026-del/pr-sentinel
   cd pr-sentinel
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. Set env:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   export PR_SENTINEL_API_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
   echo "PR_SENTINEL_API_KEY=$PR_SENTINEL_API_KEY"
   ```

3. Start the backend:
   ```bash
   cd backend && uvicorn main:app --reload
   ```

4. Start the web demo in a second terminal:
   ```bash
   cd web
   echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > .env.local
   echo "NEXT_PUBLIC_API_KEY=$PR_SENTINEL_API_KEY" >> .env.local
   npm install && npm run dev
   ```

5. Open `http://localhost:3000/demo`, or call the API directly:
   ```bash
   curl -X POST http://localhost:8000/review/sync \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $PR_SENTINEL_API_KEY" \
     -d '{
       "diff": "--- a/api.py\n+++ b/api.py\n@@ -1 +1,3 @@\n+query = f\"SELECT * FROM users WHERE id = {user_id}\"",
       "pr_title": "Add user lookup",
       "pr_body": "Fast user lookup endpoint"
     }'
   ```

---

## Tests

```bash
pip install -r backend/requirements.txt
pytest tests/ -v          # runs offline (aggregator, parser, schema validation)
ANTHROPIC_API_KEY=sk-ant-... pytest tests/ -v -m live_api   # add the live-API tests
```

`live_api` is the pytest marker on the 5 tests that actually call Claude. Everything else runs without a key.

---

## Deploy

### Backend (Modal)

```bash
# One-time: create the secret bundle Modal reads at runtime.
modal secret create pr-sentinel-secrets \
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
    PR_SENTINEL_API_KEY=$PR_SENTINEL_API_KEY \
    CORS_ALLOWED_ORIGINS=https://<your-frontend>.vercel.app

# Deploy. The SQLite fallback lives on the pr-sentinel-data Volume so runs
# survive container scale-to-zero. For Supabase, add SUPABASE_URL / SUPABASE_KEY
# to the same secret.
modal deploy backend/modal_app.py
```

### Frontend (Vercel)

```bash
cd web
vercel env add NEXT_PUBLIC_BACKEND_URL production   # e.g. https://<...>.modal.run
vercel env add NEXT_PUBLIC_API_KEY production       # same value as PR_SENTINEL_API_KEY
vercel --prod
```

Both env vars are baked at build time. Set them BEFORE `vercel --prod` or the production bundle will point at `http://localhost:8000` with no API key.

---

## How it works

```
PR diff + title + body
        |
        +-- [code_review lens]   --+
        +-- [security lens]      --+  asyncio.gather (parallel)
        +-- [reality lens]       --+
        +-- [adversarial lens]   --+
                                  |
                            aggregator.py
                                  |
                        {verdict, lenses, run_id}
```

The diff is wrapped in `<diff>` tags inside the user message; each lens system prompt explicitly tells Claude to treat the contents as untrusted data, not instructions. Schema validation rejects any lens response whose verdict is not one of `PASS / NEEDS-FIXES / BLOCK`.

---

## Comparison

| Product       | Review models | Latency | Free tier      | Open-core |
|---------------|---------------|---------|----------------|-----------|
| Greptile      | 1             | ~30s    | Limited        | No        |
| CodeRabbit    | 1             | ~20s    | Yes (OSS only) | No        |
| Korbit        | 1             | ~25s    | Yes            | No        |
| Bito          | 1             | ~15s    | Yes            | No        |
| **PR Sentinel** | **4**       | **~15s** | **5 PRs/mo** | **Planned** |

The unique angle: competitors run one model from one perspective. PR Sentinel runs four specialized reviewers in parallel, each with a different attack surface. The adversarial lens finds what the security lens normalizes. The reality checker finds what the code reviewer ignores.

---

## Stack

- **Backend**: FastAPI on Modal (serverless, scales to zero), durable SQLite on a Modal Volume by default, Supabase opt-in
- **LLM**: Claude Sonnet 4.6, 4 parallel async calls per review
- **Frontend**: Next.js 14 App Router on Vercel
- **GitHub integration**: GitHub App with JWT auth (V0.2, not yet wired)

---

## Security posture (V0.1)

- All `POST /review/sync` and `GET /runs/:id` calls require an `X-API-Key` header. Missing or wrong key returns 401. Missing server-side config returns 503.
- Per-IP rate limit, defaults to 20 requests / hour. In-memory, so it resets per Modal container; for multi-container scale, swap for Redis or Cloudflare.
- Diff size capped at 100 KB (`MAX_DIFF_BYTES`). PR title capped at 500 chars, body at 8 KB.
- CORS locked to `CORS_ALLOWED_ORIGINS` (defaults to `http://localhost:3000` for dev). Set it explicitly in your Modal secret before deploy.
- `/webhook` requires `GITHUB_WEBHOOK_SECRET` and validates HMAC SHA-256 before any handling. Without the secret set, the endpoint returns 503.
- Lens output is schema-validated. Unknown verdicts coerce to `NEEDS-FIXES` (fail closed).
- See `docs/install-github-app.md` for the V0.2 GitHub App setup.

---

## Project structure

```
pr-sentinel/
  backend/
    main.py          # FastAPI app (auth, rate limit, routes)
    reviewers.py     # 4 lens prompts, schema validation, asyncio.gather
    aggregator.py    # verdict collapse logic
    storage.py       # Supabase / SQLite abstraction (async-safe)
    modal_app.py     # Modal deploy wrapper (uses pr-sentinel-data Volume)
    requirements.txt
  web/
    app/
      page.tsx       # Landing page
      demo/page.tsx  # Interactive demo
    lib/api.ts       # Backend fetch wrapper (sends X-API-Key)
  tests/
    test_reviewers.py
    conftest.py
  docs/
    install-github-app.md
  HOW-DECISION.md
```

---

## V0.2 roadmap

- Real GitHub App webhook pipeline (parse PR events, post Check Run + comment)
- Persistent / cross-container rate limit (Redis or Cloudflare)
- PR comment with formatted Markdown report
- Usage dashboard
- Free-tier enforcement (5 PRs/month per installation)
