"""
Modal deployment wrapper for PR Sentinel backend.

Deploy: modal deploy backend/modal_app.py
"""

import modal

# Build image with all required packages
image = modal.Image.debian_slim().pip_install(
    "fastapi",
    "anthropic",
    "supabase",
    "pygithub",
    "uvicorn",
    "httpx",
    "pydantic",
    "python-dotenv",
)

app = modal.App("pr-sentinel", image=image)

# Mount the backend directory so Modal can find local modules
backend_mount = modal.Mount.from_local_dir(
    "/Users/joyd/dev/pr-sentinel/backend",
    remote_path="/backend",
)


@app.function(
    secrets=[
        modal.Secret.from_name("pr-sentinel-secrets"),
    ],
    mounts=[backend_mount],
    allow_concurrent_inputs=10,
    timeout=120,
)
@modal.asgi_app()
def web():
    import sys
    sys.path.insert(0, "/backend")
    from main import app as fastapi_app
    return fastapi_app
