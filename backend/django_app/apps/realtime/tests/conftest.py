"""Shared fixtures for the realtime test package.

Generic users come from the project-wide ``conftest.py``; only what several
realtime modules need lives here.
"""

import pytest
from apps.problems.models import Problem
from apps.submissions.models import Submission


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def submission(db, user, problem):
    """A pending submission owned by ``user`` - the thing WS clients watch."""
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x=1",
        language=Submission.Language.PYTHON,
    )
