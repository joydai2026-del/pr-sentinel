"""
Conftest: skip ONLY tests that actually need a live Anthropic API key.

Tests opt in to the live-API requirement by adding @pytest.mark.live_api.
Pure-logic tests (aggregator, parsers) always run.
"""

import os

import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line(
        "markers",
        "live_api: requires ANTHROPIC_API_KEY in environment to run",
    )


def pytest_collection_modifyitems(items):
    if os.environ.get("ANTHROPIC_API_KEY", ""):
        return
    skip_marker = pytest.mark.skip(
        reason="ANTHROPIC_API_KEY not set; live_api tests skipped"
    )
    for item in items:
        if "live_api" in item.keywords:
            item.add_marker(skip_marker)
