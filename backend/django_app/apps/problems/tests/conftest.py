"""Shared fixtures for the problems test package.

Generic clients and users come from the project-wide ``conftest.py``; only
problem-domain fixtures live here.
"""

import pytest
from apps.problems.models import Problem


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="d",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )
