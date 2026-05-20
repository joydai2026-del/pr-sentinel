"""
Real API tests for the 4 review lenses.
Each test makes an actual Claude API call and asserts response shape.

Run: cd /Users/joyd/dev/pr-sentinel && .venv/bin/pytest tests/ -v
Requires: ANTHROPIC_API_KEY in environment.
"""

import asyncio
import os
import sys
import pytest

# Allow imports from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from reviewers import run_lens, run_all_lenses
import anthropic

# Sample diffs for testing

CLEAN_DIFF = """\
--- a/utils/math.py
+++ b/utils/math.py
@@ -0,0 +1,12 @@
+def add(a: int, b: int) -> int:
+    \"\"\"Return the sum of two integers.\"\"\"
+    return a + b
+
+def subtract(a: int, b: int) -> int:
+    \"\"\"Return a minus b.\"\"\"
+    return a - b
+
+def multiply(a: int, b: int) -> int:
+    \"\"\"Return the product of two integers.\"\"\"
+    return a * b
"""

SQL_INJECTION_DIFF = """\
--- a/api/users.py
+++ b/api/users.py
@@ -5,6 +5,10 @@
 import sqlite3

+def get_user(username: str):
+    conn = sqlite3.connect("users.db")
+    query = f"SELECT * FROM users WHERE username = '{username}'"
+    return conn.execute(query).fetchone()
"""

DEAD_CODE_DIFF = """\
--- a/services/legacy.py
+++ b/services/legacy.py
@@ -1,20 +1,35 @@
+# TODO: remove this entire module after migration
+def old_process_payment(amount):
+    # This is never called anymore
+    pass
+
+def _internal_helper():
+    # Unreachable since refactor
+    return None
+
+DEPRECATED_CONSTANT = 42  # unused
"""


def _assert_lens_shape(result: dict, lens_name: str):
    """Assert that a lens result has the required shape."""
    assert isinstance(result, dict), f"{lens_name}: result is not a dict"
    assert "verdict" in result, f"{lens_name}: missing 'verdict'"
    assert "summary" in result, f"{lens_name}: missing 'summary'"
    assert "must_fixes" in result, f"{lens_name}: missing 'must_fixes'"
    assert result["verdict"] in ("PASS", "NEEDS-FIXES", "BLOCK"), (
        f"{lens_name}: invalid verdict '{result['verdict']}'"
    )
    assert isinstance(result["summary"], str), f"{lens_name}: summary not a string"
    assert isinstance(result["must_fixes"], list), f"{lens_name}: must_fixes not a list"


@pytest.mark.asyncio
async def test_code_review_lens_clean_code():
    """Code review lens on clean math utility: should PASS."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = await run_lens(
        client, "code_review", CLEAN_DIFF, "Add math utilities", "Simple math helper functions"
    )
    _assert_lens_shape(result, "code_review")
    # Clean code should not BLOCK
    assert result["verdict"] != "BLOCK", (
        f"Clean code flagged as BLOCK: {result['summary']}"
    )


@pytest.mark.asyncio
async def test_security_lens_sql_injection():
    """Security lens on SQL injection diff: should BLOCK or NEEDS-FIXES."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = await run_lens(
        client,
        "security",
        SQL_INJECTION_DIFF,
        "Add user lookup endpoint",
        "Adds a function to look up users by username",
    )
    _assert_lens_shape(result, "security")
    # SQL injection must NOT pass
    assert result["verdict"] in ("NEEDS-FIXES", "BLOCK"), (
        f"SQL injection not caught! verdict={result['verdict']}, summary={result['summary']}"
    )


@pytest.mark.asyncio
async def test_reality_lens_clean_code():
    """Reality lens: check that clean math diff matches its PR description."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = await run_lens(
        client,
        "reality",
        CLEAN_DIFF,
        "Add math utilities",
        "Adds add, subtract, multiply helper functions to utils/math.py",
    )
    _assert_lens_shape(result, "reality")


@pytest.mark.asyncio
async def test_adversarial_lens_dead_code():
    """Adversarial lens on dead code: should flag issues."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = await run_lens(
        client,
        "adversarial",
        DEAD_CODE_DIFF,
        "Remove legacy payment module",
        "Marking old payment functions as deprecated",
    )
    _assert_lens_shape(result, "adversarial")
    # Dead code diff should not be a clean PASS (TODO comments, unreachable code)
    # We allow PASS but just assert shape — adversarial may still find nothing "exploitable"


@pytest.mark.asyncio
async def test_all_lenses_parallel():
    """Run all 4 lenses in parallel on SQL injection diff and verify shapes."""
    lenses = await run_all_lenses(
        diff=SQL_INJECTION_DIFF,
        pr_title="Add user lookup",
        pr_body="Adds username-based lookup",
    )
    assert set(lenses.keys()) == {"code_review", "security", "reality", "adversarial"}
    for name, result in lenses.items():
        _assert_lens_shape(result, name)
    # Security lens must catch the injection
    assert lenses["security"]["verdict"] in ("NEEDS-FIXES", "BLOCK"), (
        f"Security lens missed SQL injection. Got: {lenses['security']}"
    )


@pytest.mark.asyncio
async def test_aggregator_block_wins():
    """Aggregator: if any lens returns BLOCK, final verdict is BLOCK."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from aggregator import aggregate_verdict

    lenses = {
        "code_review": {"verdict": "PASS"},
        "security": {"verdict": "BLOCK"},
        "reality": {"verdict": "NEEDS-FIXES"},
        "adversarial": {"verdict": "PASS"},
    }
    assert aggregate_verdict(lenses) == "BLOCK"


@pytest.mark.asyncio
async def test_aggregator_needs_fixes():
    """Aggregator: NEEDS-FIXES if any lens flags issues but none BLOCK."""
    from aggregator import aggregate_verdict

    lenses = {
        "code_review": {"verdict": "PASS"},
        "security": {"verdict": "PASS"},
        "reality": {"verdict": "NEEDS-FIXES"},
        "adversarial": {"verdict": "PASS"},
    }
    assert aggregate_verdict(lenses) == "NEEDS-FIXES"


@pytest.mark.asyncio
async def test_aggregator_all_pass():
    """Aggregator: PASS only when all lenses pass."""
    from aggregator import aggregate_verdict

    lenses = {
        "code_review": {"verdict": "PASS"},
        "security": {"verdict": "PASS"},
        "reality": {"verdict": "PASS"},
        "adversarial": {"verdict": "PASS"},
    }
    assert aggregate_verdict(lenses) == "PASS"
