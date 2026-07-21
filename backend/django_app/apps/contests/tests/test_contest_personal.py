"""Tests for the rating fields on ContestScore."""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from apps.contests.services import calculate_score
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.utils import timezone

# user comes from conftest.


def _problem(title):
    return Problem.objects.create(
        title=title,
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


def _active_contest():
    now = timezone.now()
    return Contest.objects.create(
        title="Live",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
    )


def _sub(user, problem, contest, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


@pytest.mark.django_db
def test_rating_fields_default_null(user):
    c = _active_contest()
    cs = ContestScore.objects.create(user=user, contest=c)
    assert cs.rating_delta is None
    assert cs.rating_after is None


@pytest.mark.django_db
def test_calculate_score_does_not_clobber_rating(user):
    c = _active_contest()
    p = _problem("P")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    calculate_score(user, c)  # creates the ContestScore

    cs = ContestScore.objects.get(user=user, contest=c)
    cs.rating_delta = -42
    cs.rating_after = 2147
    cs.save()

    # New submission → recalc; rating fields must survive.
    _sub(user, p, c, Submission.Verdict.AC)
    calculate_score(user, c)

    cs.refresh_from_db()
    assert cs.rating_delta == -42
    assert cs.rating_after == 2147
