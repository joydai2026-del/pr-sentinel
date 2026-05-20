"""
Aggregator: combines 4 lens verdicts into a single final verdict.

Rules:
- BLOCK if ANY lens returns BLOCK
- NEEDS-FIXES if ANY lens returns NEEDS-FIXES (and none is BLOCK)
- PASS only if ALL lenses return PASS
"""

from typing import Any


VERDICT_PRIORITY = {"BLOCK": 3, "NEEDS-FIXES": 2, "PASS": 1}


def aggregate_verdict(lenses: dict[str, dict[str, Any]]) -> str:
    """Return the worst-case verdict across all lenses."""
    verdicts = [
        lens_result.get("verdict", "NEEDS-FIXES")
        for lens_result in lenses.values()
    ]
    # Normalize
    verdicts = [v.upper() for v in verdicts]
    # Pick highest priority
    highest = max(verdicts, key=lambda v: VERDICT_PRIORITY.get(v, 2))
    return highest


def count_must_fixes(lenses: dict[str, dict[str, Any]]) -> int:
    total = 0
    for lens_result in lenses.values():
        total += len(lens_result.get("must_fixes", []))
    return total


def build_review_result(
    lenses: dict[str, dict[str, Any]],
    run_id: str,
) -> dict[str, Any]:
    verdict = aggregate_verdict(lenses)
    total_fixes = count_must_fixes(lenses)

    # Token accounting
    total_input = sum(
        lens_data.get("_tokens", {}).get("input", 0) for lens_data in lenses.values()
    )
    total_output = sum(
        lens_data.get("_tokens", {}).get("output", 0) for lens_data in lenses.values()
    )

    # Strip internal _tokens from lens output (keep it clean for API response)
    clean_lenses = {}
    for name, data in lenses.items():
        clean_lenses[name] = {
            k: v for k, v in data.items() if not k.startswith("_")
        }

    return {
        "verdict": verdict,
        "total_must_fixes": total_fixes,
        "lenses": clean_lenses,
        "run_id": run_id,
        "_meta": {
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "model": "claude-sonnet-4-6",
        },
    }
