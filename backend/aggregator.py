"""
Aggregator: combines 4 lens verdicts into a single final verdict.

Rules:
- BLOCK if ANY lens returns BLOCK
- NEEDS-FIXES if ANY lens returns NEEDS-FIXES (and none is BLOCK)
- PASS only if ALL lenses return PASS

Unknown/missing verdicts are treated as NEEDS-FIXES (fail-closed).
"""

from types import MappingProxyType
from typing import Any


VERDICT_PRIORITY = MappingProxyType({"BLOCK": 3, "NEEDS-FIXES": 2, "PASS": 1})
_UNKNOWN_PRIORITY = 2  # same as NEEDS-FIXES. fail closed


def _coerce_verdict(raw: Any) -> str:
    verdict = str(raw or "").upper().strip()
    return verdict if verdict in VERDICT_PRIORITY else "NEEDS-FIXES"


def aggregate_verdict(lenses: dict[str, dict[str, Any]]) -> str:
    """Return the worst-case verdict across all lenses."""
    if not lenses:
        return "NEEDS-FIXES"
    verdicts = [_coerce_verdict(lens.get("verdict")) for lens in lenses.values()]
    return max(verdicts, key=lambda v: VERDICT_PRIORITY.get(v, _UNKNOWN_PRIORITY))


def count_must_fixes(lenses: dict[str, dict[str, Any]]) -> int:
    total = 0
    for lens_result in lenses.values():
        fixes = lens_result.get("must_fixes", [])
        if isinstance(fixes, list):
            total += len(fixes)
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
