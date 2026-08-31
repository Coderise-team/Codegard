"""Shared fixtures for the problems test package.

Generic clients and users come from the project-wide ``conftest.py``; only
problem-domain fixtures live here.
"""

import pytest
from factories import make_problem


@pytest.fixture
def problem(db):
    return make_problem("Two Sum")


@pytest.fixture
def problem_payload():
    """Factory: a full, valid create payload; callers drop or override pieces."""

    def _payload(**overrides):
        data = {
            "title": "Two Sum",
            "description": "Find two numbers that add up to target.",
            "difficulty": "easy",
            "time_limit": 1000,
            "memory_limit": 256,
            "input_format": "First line: n. Second line: n integers.",
            "output_format": "Two indices.",
            "constraints": "2 <= n <= 1e5\n-1e9 <= a[i] <= 1e9",
            "tags": ["Arrays"],
        }
        data.update(overrides)
        return data

    return _payload
