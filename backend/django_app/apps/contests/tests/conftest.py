"""Shared fixtures for the contests test package.

Generic clients and users (``api_client``, ``user``, ``admin``, ``user_client``,
``custom_admin_client``) come from the project-wide ``conftest.py``; only what
several contests modules need lives here.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.utils import timezone


@pytest.fixture
def other(db, django_user_model):
    """A second user, for "someone else's contest/score" scenarios."""
    return django_user_model.objects.create_user(
        username="other", email="other@test.com", password="pass"
    )


@pytest.fixture
def users(db, django_user_model):
    """Three users - enough to rank a field and still have a no-show."""
    return [
        django_user_model.objects.create_user(
            username=f"u{i}", email=f"u{i}@t.com", password="pass"
        )
        for i in range(3)
    ]


@pytest.fixture
def problems(db):
    """Two problems, so "solved one of two" scenarios are possible."""
    return [
        Problem.objects.create(
            title=f"P{i}",
            description="",
            difficulty=Problem.Difficulty.EASY,
            time_limit=1000,
            memory_limit=256,
        )
        for i in range(2)
    ]


@pytest.fixture
def finished_contest(db):
    """A contest that ran from three hours ago until an hour ago."""
    now = timezone.now()
    return Contest.objects.create(
        title="Finished",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
    )


@pytest.fixture
def submit():
    """Factory: a submission. An AC one fires the scoring signal."""

    def make(user, problem, contest, verdict=Submission.Verdict.AC):
        return Submission.objects.create(
            user=user,
            problem=problem,
            contest=contest,
            code="x",
            language=Submission.Language.PYTHON,
            verdict=verdict,
        )

    return make
