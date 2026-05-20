"""
4-lens parallel reviewer module.
Each lens calls Claude with a tailored system prompt and returns structured JSON.
"""

import asyncio
import json
import os
from typing import Any

import anthropic

# HOW DECISION: claude-sonnet-4-6 for all 4 lenses (not opus) to keep cost ~4x lower.
# Logged in HOW-DECISION.md.
REVIEW_MODEL = "claude-sonnet-4-6"

# Structured output schema each lens must return
LENS_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "NEEDS-FIXES", "BLOCK"]},
        "summary": {"type": "string"},
        "must_fixes": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["verdict", "summary", "must_fixes"],
}

LENS_PROMPTS = {
    "code_review": (
        "You are reviewing a unified diff for code quality issues. "
        "Focus on: bugs, style consistency, missing tests, dead code. "
        "Return JSON with exactly these fields: "
        "{verdict: 'PASS'|'NEEDS-FIXES'|'BLOCK', summary: string, must_fixes: string[]}. "
        "verdict='BLOCK' only for show-stopping bugs. "
        "verdict='NEEDS-FIXES' for non-blocking issues. "
        "verdict='PASS' if code quality is acceptable. "
        "Return ONLY valid JSON, no markdown fences."
    ),
    "security": (
        "You are a security engineer reviewing this diff. "
        "Focus on: SQL injection, XSS, CSRF, auth bypass, secrets/credentials in code, "
        "unsafe deserialization, OWASP Top 10, privilege escalation, path traversal. "
        "Return JSON with exactly these fields: "
        "{verdict: 'PASS'|'NEEDS-FIXES'|'BLOCK', summary: string, must_fixes: string[]}. "
        "verdict='BLOCK' for critical vulnerabilities (injection, secret leak, auth bypass). "
        "verdict='NEEDS-FIXES' for medium severity. "
        "verdict='PASS' if no security issues found. "
        "Return ONLY valid JSON, no markdown fences."
    ),
    "reality": (
        "You are reviewing a diff against the PR title and body to check if the change "
        "actually solves what it claims. Look for: hand-waving in commits, mismatched scope, "
        "fake fixes that don't address root cause, incomplete implementations, "
        "missing edge cases claimed to be handled, tests that don't test what they claim. "
        "Return JSON with exactly these fields: "
        "{verdict: 'PASS'|'NEEDS-FIXES'|'BLOCK', summary: string, must_fixes: string[]}. "
        "verdict='BLOCK' if the change fundamentally does not deliver what the PR claims. "
        "verdict='NEEDS-FIXES' for partial or misleading implementations. "
        "verdict='PASS' if the change matches its stated purpose. "
        "Return ONLY valid JSON, no markdown fences."
    ),
    "adversarial": (
        "You are an adversarial reviewer. Your job is to BREAK this code. "
        "Find: edge cases that cause crashes, hidden coupling to global state, "
        "race conditions, off-by-one errors, integer overflow, null pointer risks, "
        "future-proofing gaps, API contract violations, brittle assumptions. "
        "Assume the worst-case input. "
        "Return JSON with exactly these fields: "
        "{verdict: 'PASS'|'NEEDS-FIXES'|'BLOCK', summary: string, must_fixes: string[]}. "
        "verdict='BLOCK' if you found exploitable crashes or data corruption. "
        "verdict='NEEDS-FIXES' for significant robustness gaps. "
        "verdict='PASS' if the code is reasonably robust under adversarial inputs. "
        "Return ONLY valid JSON, no markdown fences."
    ),
}


def _build_user_message(diff: str, pr_title: str, pr_body: str) -> str:
    return f"""PR Title: {pr_title}

PR Body:
{pr_body or "(no description provided)"}

Unified Diff:
```diff
{diff}
```

Review the diff above and return your JSON verdict."""


def _parse_lens_response(text: str, lens_name: str) -> dict[str, Any]:
    """Parse Claude's response, extracting JSON robustly."""
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
    try:
        result = json.loads(text)
        # Normalize verdict to uppercase
        if "verdict" in result:
            result["verdict"] = str(result["verdict"]).upper()
        # Ensure must_fixes is a list
        if "must_fixes" not in result:
            result["must_fixes"] = []
        return result
    except json.JSONDecodeError as e:
        # Fallback: return structured error rather than crashing
        return {
            "verdict": "NEEDS-FIXES",
            "summary": f"Lens {lens_name} returned unparseable response: {text[:200]}",
            "must_fixes": [f"Parse error: {e}"],
        }


async def run_lens(
    client: anthropic.AsyncAnthropic,
    lens_name: str,
    diff: str,
    pr_title: str,
    pr_body: str,
) -> dict[str, Any]:
    """Run a single review lens asynchronously."""
    system_prompt = LENS_PROMPTS[lens_name]
    user_message = _build_user_message(diff, pr_title, pr_body)

    response = await client.messages.create(
        model=REVIEW_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text
    result = _parse_lens_response(text, lens_name)
    result["_tokens"] = {
        "input": response.usage.input_tokens,
        "output": response.usage.output_tokens,
    }
    return result


async def run_all_lenses(
    diff: str,
    pr_title: str = "",
    pr_body: str = "",
) -> dict[str, dict[str, Any]]:
    """Run all 4 lenses in parallel using asyncio.gather."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    tasks = [
        run_lens(client, lens_name, diff, pr_title, pr_body)
        for lens_name in LENS_PROMPTS
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    lenses: dict[str, dict[str, Any]] = {}
    for lens_name, result in zip(LENS_PROMPTS.keys(), results):
        if isinstance(result, Exception):
            lenses[lens_name] = {
                "verdict": "NEEDS-FIXES",
                "summary": f"Lens error: {result}",
                "must_fixes": [str(result)],
                "_tokens": {"input": 0, "output": 0},
            }
        else:
            lenses[lens_name] = result

    return lenses
