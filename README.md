# PR Sentinel

**Multi-lens AI code review for GitHub pull requests.**

PR Sentinel runs 4 independent AI reviewers in parallel on every PR: a code quality reviewer, a security engineer, a reality checker, and an adversarial attacker. It collapses their verdicts into one clear result (PASS / NEEDS-FIXES / BLOCK) and posts it as a GitHub comment or Check Run. Where competitors run one model from one angle, Sentinel runs four — in the same time it takes to run one.

---

## Quickstart (demo — no GitHub App needed)

1. Clone and install:
   ```bash
   git clone https://github.com/joydai2026-del/pr-sentinel
   cd pr-sentinel
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. Set your API key:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. Start the backend:
   ```bash
   cd backend && uvicorn main:app --reload
   ```

4. Open the demo: visit `http://localhost:3000/demo` (run `cd web && npm install && npm run dev` first), or call the API directly:
   ```bash
   curl -X POST http://localhost:8000/review/sync \
     -H "Content-Type: application/json" \
     -d '{
       "diff": "--- a/api.py\n+++ b/api.py\n@@ -1 +1,3 @@\n+query = f\"SELECT * FROM users WHERE id = {user_id}\"",
       "pr_title": "Add user lookup",
       "pr_body": "Fast user lookup endpoint"
     }'
   ```

---

## Live URLs

| Surface | URL | Status |
|---|---|---|
| Backend (Modal) | `https://joydai2026-del--pr-sentinel-web.modal.run` | Pending deploy |
| Frontend (Vercel) | `https://pr-sentinel.vercel.app` | Pending deploy |
| Health check | `https://<modal-url>/healthz` | Pending deploy |

> Deploy instructions: `modal deploy backend/modal_app.py` then `cd web && vercel --prod`

---

## How it works

```
PR diff + title + body
        │
        ├── [code_review lens]  ──┐
        ├── [security lens]    ──┤  asyncio.gather (parallel)
        ├── [reality lens]     ──┤
        └── [adversarial lens] ──┘
                                  │
                            aggregator.py
                                  │
                        {verdict, lenses, run_id}
                                  │
                          GitHub comment / Check Run
```

---

## Comparison

| Product | Review models | Latency | Free tier | Open-core |
|---|---|---|---|---|
| Greptile | 1 | ~30s | Limited | No |
| CodeRabbit | 1 | ~20s | Yes (OSS only) | No |
| Korbit | 1 | ~25s | Yes | No |
| Bito | 1 | ~15s | Yes | No |
| **PR Sentinel** | **4** | **~15s** | **5 PRs/mo** | **Planned** |

**The unique angle**: competitors run one model from one perspective. PR Sentinel runs four specialized reviewers in parallel, each with a different attack surface. The adversarial lens finds what the security lens normalizes. The reality checker finds what the code reviewer ignores.

---

## Stack

- **Backend**: FastAPI on Modal (serverless, scales to zero)
- **LLM**: Claude Sonnet 4.6 — 4 parallel async calls per review
- **Frontend**: Next.js 14 App Router on Vercel
- **Storage**: Supabase Pro (SQLite fallback for local dev)
- **GitHub integration**: GitHub App with JWT auth (V0.2)

---

## Project structure

```
pr-sentinel/
  backend/
    main.py          # FastAPI app (routes)
    reviewers.py     # 4 lens functions + asyncio.gather
    aggregator.py    # verdict collapse logic
    storage.py       # Supabase / SQLite abstraction
    modal_app.py     # Modal deploy wrapper
    requirements.txt
  web/
    app/
      page.tsx       # Landing page
      demo/page.tsx  # Interactive demo
    lib/api.ts       # Backend fetch wrapper
  tests/
    test_reviewers.py
    conftest.py
  docs/
    install-github-app.md  # Manual setup guide for JJ
  HOW-DECISION.md    # Every HOW call made during the build
```

---

## V0.2 roadmap

- GitHub webhook handler (verify HMAC, parse PR events)
- Post GitHub Check Run with per-lens details
- PR comment with formatted Markdown report
- Rate limiting + free tier enforcement
- Usage dashboard
