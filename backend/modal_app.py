"""
Modal deployment wrapper for PR Sentinel backend.

Deploy:  modal deploy backend/modal_app.py

Prereqs (one-time):
  modal secret create pr-sentinel-secrets \\
      ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \\
      PR_SENTINEL_API_KEY=<random secret> \\
      CORS_ALLOWED_ORIGINS=https://<your-frontend>.vercel.app \\
      GITHUB_WEBHOOK_SECRET=<unused until GitHub App ships>

The /data Modal Volume keeps the SQLite fallback durable across cold starts;
production deploys should set SUPABASE_URL + SUPABASE_KEY in the same secret
to use Supabase instead.
"""

from pathlib import Path

import modal

_BACKEND_DIR = Path(__file__).resolve().parent

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements(str(_BACKEND_DIR / "requirements.txt"))
    .add_local_dir(str(_BACKEND_DIR), remote_path="/backend")
)

app = modal.App("pr-sentinel", image=image)

volume = modal.Volume.from_name("pr-sentinel-data", create_if_missing=True)


@app.function(
    secrets=[modal.Secret.from_name("pr-sentinel-secrets")],
    volumes={"/data": volume},
    timeout=120,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def web():
    import os
    import sys

    sys.path.insert(0, "/backend")
    # Point the SQLite fallback at the durable Volume so runs survive scale-to-zero
    os.environ.setdefault("SQLITE_DB_PATH", "/data/pr-sentinel.db")
    from main import app as fastapi_app

    return fastapi_app
