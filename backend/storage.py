"""
Storage layer: Supabase Pro preferred, SQLite fallback.

HOW DECISION: try Supabase via env vars; if SUPABASE_URL is unset or connection fails,
fall back to SQLite at backend/data.db. This keeps the MVP deployable without
manual Supabase setup while still being serverless-first in production.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

_supabase_client = None
_use_supabase = False


def _init_supabase() -> bool:
    global _supabase_client, _use_supabase
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        _use_supabase = True
        return True
    except Exception:
        return False


# SQLite fallback path
_DB_PATH = Path(__file__).parent / "data.db"


def _init_sqlite() -> None:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS review_runs (
            id TEXT PRIMARY KEY,
            pr_url TEXT,
            status TEXT,
            verdict TEXT,
            started_at TEXT,
            finished_at TEXT,
            lenses TEXT
        )
    """)
    conn.commit()
    conn.close()


def get_backend() -> str:
    if _use_supabase:
        return "supabase"
    return "sqlite"


# Initialize on import
if not _init_supabase():
    _init_sqlite()


def save_run(
    run_id: str,
    pr_url: str,
    status: str,
    verdict: str | None,
    lenses: dict[str, Any] | None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> None:
    row = {
        "id": run_id,
        "pr_url": pr_url,
        "status": status,
        "verdict": verdict,
        "started_at": (started_at or datetime.now(timezone.utc)).isoformat(),
        "finished_at": finished_at.isoformat() if finished_at else None,
        "lenses": json.dumps(lenses) if lenses else None,
    }

    if _use_supabase:
        _supabase_client.table("review_runs").upsert(row).execute()
    else:
        conn = sqlite3.connect(_DB_PATH)
        conn.execute(
            """INSERT OR REPLACE INTO review_runs
               (id, pr_url, status, verdict, started_at, finished_at, lenses)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                row["id"],
                row["pr_url"],
                row["status"],
                row["verdict"],
                row["started_at"],
                row["finished_at"],
                row["lenses"],
            ),
        )
        conn.commit()
        conn.close()


def get_run(run_id: str) -> dict[str, Any] | None:
    if _use_supabase:
        result = (
            _supabase_client.table("review_runs")
            .select("*")
            .eq("id", run_id)
            .execute()
        )
        if result.data:
            row = result.data[0]
            if isinstance(row.get("lenses"), str):
                row["lenses"] = json.loads(row["lenses"])
            return row
        return None
    else:
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM review_runs WHERE id = ?", (run_id,)
        ).fetchone()
        conn.close()
        if row:
            d = dict(row)
            if d.get("lenses"):
                d["lenses"] = json.loads(d["lenses"])
            return d
        return None
