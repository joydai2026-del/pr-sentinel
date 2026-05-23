# HOW-DECISION.md. PR Sentinel MVP v0.1

Every HOW decision made during the build. JJ provides WHAT; Claude handles HOW.

---

## HOW-01: Model choice for review lenses

**Topic**: Which Claude model for the 4 parallel review lenses?

| Option | Pros | Cons |
|---|---|---|
| A) `claude-opus-4-7` (JJ's parent model) | Highest reasoning quality | ~5x more expensive; slower |
| B) `claude-sonnet-4-6` | Fast, accurate, 4x cheaper than Opus | Slightly less depth on very complex logic |
| C) `claude-haiku-3-5` | Cheapest | Too shallow for security/adversarial reasoning |

**Preference: B**. claude-sonnet-4-6 for all 4 lenses.

**Why**: Cost math matters for a review tool. Each PR review calls Claude 4x. At Opus pricing (~$15/M output tokens), a team running 100 PRs/day hits ~$150/day just in lens costs. Sonnet runs ~$3/M output tokens. roughly 5x cheaper with 85-90% of the quality for code review tasks. The adversarial and security lenses benefit from multi-turn reasoning chains, which Sonnet handles well. Opus is reserved for future "deep investigation" mode (V0.3).

**Researched via**: Anthropic pricing page + Sonnet model card benchmarks.

---

## HOW-02: Storage backend. Supabase vs SQLite

**Topic**: Where to store review run metadata?

| Option | Pros | Cons |
|---|---|---|
| A) Supabase Pro | Serverless-first, matches JJ rule, scales, has RLS | Requires SUPABASE_URL + SUPABASE_KEY in env |
| B) SQLite fallback | Zero config, works locally and in Modal | Not serverless-native; Modal volumes needed for persistence |
| C) In-memory only | Simplest | Data lost on restart, useless for production |

**Preference: A with B fallback** (implemented in `backend/storage.py`).

**Why**: JJ's rule says serverless-first (Supabase Pro). The MVP checks for SUPABASE_URL at startup. If missing, it falls back to SQLite at `backend/data.db` so the demo works without credentials. This is documented behavior, not a silent failure.

**Decision recorded**: SUPABASE_URL was not set in JJ's shell at build time. SQLite fallback is active for local runs. Set SUPABASE_URL + SUPABASE_KEY in Modal secrets to switch to Supabase automatically.

---

## HOW-03: GitHub integration approach

**Topic**: JWT-based GitHub App auth vs OAuth App vs Personal Access Token?

| Option | Pros | Cons |
|---|---|---|
| A) GitHub App (JWT + Installation token) | Proper scoped access, per-repo install, check runs API | Requires App registration (JJ's manual step) |
| B) OAuth App | Easier to register | Broader permission scope, user-bound not install-bound |
| C) Personal Access Token | Trivial setup | Not appropriate for a product; not per-user |

**Preference: A**. GitHub App with JWT auth.

**Why**: PR Sentinel is a GitHub App product, not a personal tool. GitHub Apps get fine-grained permissions (pull_requests: read, checks: write), can be installed per-repo, and scale to multiple users. PAT is not viable for a product.

**V0.2 action**: JJ registers the App, pastes the private key + App ID into Modal secrets. The `/webhook` endpoint stub is already in `main.py`.

---

## HOW-04: Frontend routing. pages vs App Router

**Topic**: Next.js App Router vs Pages Router?

**Preference**: App Router (Next.js 14 default).

**Why**: The demo page requires client-side interactivity (form state, fetch calls). App Router supports `"use client"` directive cleanly. Pages Router would work too but App Router is the 2024 default and better long-term. The landing page (`/`) is a server component; demo page (`/demo`) is a client component.

---

## HOW-05: CORS policy on backend

**Topic**: Lock down CORS or allow all origins for MVP?

**Preference**: Allow all origins (`allow_origins=["*"]`) for MVP.

**Why**: The demo frontend URL isn't known at build time (Vercel assigns a random URL). For V0.2, set `CORS_ORIGINS` env var and lock to the Vercel domain + localhost. Documented in `main.py` comment.

---

## HOW-06: Aggregation logic

**Topic**: How to collapse 4 lens verdicts into 1?

**Preference**: Worst-case wins. Priority: BLOCK > NEEDS-FIXES > PASS.

**Why**: False negatives are worse than false positives for a security tool. If any lens BLOCKs, the overall verdict is BLOCK. This is conservative by design. Future V0.2 could add a "majority vote" mode for teams that want less noise.

---

## HOW-07: Async implementation

**Topic**: `asyncio.gather` vs serial calls for 4 lenses?

**Preference**: `asyncio.gather`. all 4 run in parallel.

**Why**: The anthropic Python SDK supports async. 4 parallel calls take ~the same wall time as 1 call (~5-15s), instead of 20-60s serial. FastAPI runs async natively. This is the core latency advantage of PR Sentinel.

---

## HOW-08: Error handling in lens parsing

**Topic**: What to do when Claude returns unparseable JSON?

**Preference**: Graceful degradation. If JSON parse fails, return `verdict=NEEDS-FIXES` with the raw response in `summary` and the parse error in `must_fixes`. Never crash the review run.

**Why**: The demo must never return a 500. A parse error in one lens should surface as a "soft NEEDS-FIXES" so JJ can inspect the raw response, not a hard failure.

---

## HOW-09: Test design. mock vs real API calls

**Topic**: Should tests use VCR cassettes / mocks, or real Claude API calls?

**Preference**: Real API calls. Tests skip automatically if ANTHROPIC_API_KEY is not set.

**Why**: JJ's rule is "no mock data." The value of testing the review lenses is verifying that Claude's actual response has the required shape AND that the security lens actually catches SQL injection. Mocks would make the tests meaningless for this product. The `conftest.py` auto-skip protects CI environments without the key.

---

## HOW-10: Modal deployment approach

**Topic**: Modal `@web_endpoint` vs `@asgi_app` for FastAPI?

**Preference**: `@asgi_app()` decorator. wraps the full FastAPI app.

**Why**: `@asgi_app()` supports all FastAPI features (path params, middleware, CORS, OpenAPI docs). `@web_endpoint` is simpler but limited to one function/endpoint. PR Sentinel needs multiple routes.
