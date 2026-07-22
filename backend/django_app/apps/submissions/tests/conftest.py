"""Shared fixtures for the submissions test package.

Generic clients and users (``api_client``, ``user``, ``user_client``, ``redis``)
come from the project-wide ``conftest.py``; only what several submissions
modules need lives here.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.problems.models import Problem
from django.utils import timezone


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="Find two numbers.",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def active_contest(db, problem):
    """A running contest that already holds ``problem``."""
    now = timezone.now()
    contest = Contest.objects.create(
        title="Active Contest",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
    )
    contest.problems.add(problem)
    return contest
