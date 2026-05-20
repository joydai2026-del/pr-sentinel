# Installing the PR Sentinel GitHub App

This is a manual step JJ completes after the backend is deployed.
Estimated time: 15 minutes.

---

## Prerequisites

- Modal backend deployed (you have the URL from `modal deploy`)
- A GitHub account with permission to create GitHub Apps

---

## Step 1: Create the GitHub App

1. Go to: https://github.com/settings/apps/new
   (for an org: https://github.com/organizations/YOUR_ORG/settings/apps/new)

2. Fill in:
   - **GitHub App name**: `PR Sentinel` (must be unique globally; try `pr-sentinel-jj` if taken)
   - **Homepage URL**: your Vercel frontend URL (e.g., `https://pr-sentinel.vercel.app`)
   - **Webhook URL**: `https://YOUR_MODAL_URL/webhook`
   - **Webhook secret**: generate a random string (save it — you'll need it in Step 3)

3. Permissions (Repository permissions):
   - **Pull requests**: Read
   - **Checks**: Read & Write
   - **Contents**: Read (needed to read diff context in V0.2)

4. Subscribe to events:
   - `Pull request` (opened, synchronize, reopened)

5. Under "Where can this GitHub App be installed?":
   - Select **Any account** if you want others to use it, or **Only on this account** for private use.

6. Click **Create GitHub App**.

---

## Step 2: Generate a private key

1. On the App settings page, scroll to **Private keys**.
2. Click **Generate a private key**.
3. A `.pem` file downloads automatically. Keep this safe — it's the App's identity.

4. Note these values from the App page:
   - **App ID** (visible at the top, e.g., `123456`)
   - **Client ID** (starts with `Iv1.`)

---

## Step 3: Add secrets to Modal

```bash
# Create a Modal secret named "pr-sentinel-secrets"
modal secret create pr-sentinel-secrets \
  ANTHROPIC_API_KEY="sk-ant-..." \
  GITHUB_APP_ID="123456" \
  GITHUB_APP_PRIVATE_KEY="$(cat /path/to/your-app.2024-01-01.private-key.pem)" \
  GITHUB_WEBHOOK_SECRET="your-webhook-secret-from-step-1" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_KEY="your-service-role-key"
```

Then redeploy:
```bash
cd /Users/joyd/dev/pr-sentinel
modal deploy backend/modal_app.py
```

---

## Step 4: Install the App on a repo

1. Go to: https://github.com/apps/pr-sentinel (or search your App name)
2. Click **Install**.
3. Choose which repositories to install it on.

---

## Step 5: Test the webhook

Open a test PR in a repo where the App is installed. Within ~20 seconds you should see:
- A GitHub Check Run appear on the PR (in V0.2 — the webhook stub is live but the check run posting is V0.2 work).
- The webhook endpoint at `/webhook` logs the event.

To verify the webhook is receiving events:
```bash
# Check Modal logs
modal app logs pr-sentinel
```

---

## Supabase Schema

Run this SQL in Supabase's SQL editor to create the storage table:

```sql
CREATE TABLE review_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verdict TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  lenses JSONB
);

-- Optional: index for looking up by PR URL
CREATE INDEX review_runs_pr_url_idx ON review_runs (pr_url);

-- RLS: only service role can read/write (review backend uses service role key)
ALTER TABLE review_runs ENABLE ROW LEVEL SECURITY;
```

---

## Environment variables reference

| Variable | Where to get it | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/keys | YES |
| `GITHUB_APP_ID` | GitHub App settings page | V0.2 |
| `GITHUB_APP_PRIVATE_KEY` | Downloaded .pem file content | V0.2 |
| `GITHUB_WEBHOOK_SECRET` | Set by you in Step 1 | V0.2 |
| `SUPABASE_URL` | Supabase project settings | Optional (SQLite fallback) |
| `SUPABASE_KEY` | Supabase project settings (service role) | Optional (SQLite fallback) |

---

## Troubleshooting

**Webhook not firing**: Check the App's "Advanced" tab on GitHub for delivery logs and error codes.

**Modal 500 errors**: Run `modal app logs pr-sentinel` to see the Python traceback.

**SQLite in production**: Modal's ephemeral containers don't persist SQLite data between invocations. Set `SUPABASE_URL` + `SUPABASE_KEY` for persistent storage. Until then, each container starts with a fresh database.
