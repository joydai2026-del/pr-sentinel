"""
Conftest: skip all tests if ANTHROPIC_API_KEY is not set.
"""

import os
import pytest

def pytest_configure(config):
    """Register custom marks."""
    config.addinivalue_line("markers", "asyncio: mark test as async")


def pytest_collection_modifyitems(items):
    """Skip tests requiring ANTHROPIC_API_KEY if it's not set."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        skip_marker = pytest.mark.skip(
            reason="ANTHROPIC_API_KEY not set — set it to run real API tests"
        )
        for item in items:
            item.add_marker(skip_marker)
