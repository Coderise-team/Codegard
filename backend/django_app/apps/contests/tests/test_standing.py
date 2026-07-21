"""Tests for my standing in a contest: GET /api/contests/{id}/my-standing/.

Covers the per-problem statuses (solved / attempted / open), the rank, the
empty state when the user has no ContestScore yet, and auth.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.contests.services import calculate_score
from apps.contests.views import _leaderboard_rank
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone

# api_client, user and user_client come from conftest.


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


def _url(cid):
    return reverse("contests-my-standing", args=[cid])


@pytest.mark.django_db
def test_statuses_and_rank(user_client, user):
    c = _active_contest()
    solved, attempted, untouched = _problem("A"), _problem("B"), _problem("C")
    c.problems.add(solved, attempted, untouched)
    _sub(user, solved, c, Submission.Verdict.AC)
    _sub(user, attempted, c, Submission.Verdict.WA)
    calculate_score(user, c)

    data = user_client.get(_url(c.id)).json()
    assert data["solved"] == 1
    assert data["rank"] == 1
    statuses = {p["id"]: p["status"] for p in data["problems"]}
    assert statuses[solved.id] == "solved"
    assert statuses[attempted.id] == "attempted"
    assert statuses[untouched.id] == "open"


@pytest.mark.django_db
def test_no_contestscore(user_client):
    c = _active_contest()
    c.problems.add(_problem("A"))

    data = user_client.get(_url(c.id)).json()
    assert data["score"] == 0
    assert data["solved"] == 0
    assert data["rank"] is None
    assert data["problems"][0]["status"] == "open"


@pytest.mark.django_db
def test_leaderboard_rank_none_when_user_absent(user):
    c = _active_contest()  # no ContestScore for anyone → empty leaderboard
    assert _leaderboard_rank(c, user.pk) is None


@pytest.mark.django_db
def test_requires_auth(api_client):
    c = _active_contest()
    assert api_client.get(_url(c.id)).status_code in (401, 403)
