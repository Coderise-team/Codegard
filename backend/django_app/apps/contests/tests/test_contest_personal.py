"""Tests for personal contest data: rating fields and my-standing."""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from apps.contests.services import calculate_score
from apps.contests.views import _leaderboard_rank
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


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
        status=Contest.Status.ACTIVE,
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


# --- rating fields ---------------------------------------------------------


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


# --- my-standing -----------------------------------------------------------


@pytest.mark.django_db
def test_my_standing_statuses_and_rank(client, user):
    c = _active_contest()
    solved, attempted, untouched = _problem("A"), _problem("B"), _problem("C")
    c.problems.add(solved, attempted, untouched)
    _sub(user, solved, c, Submission.Verdict.AC)
    _sub(user, attempted, c, Submission.Verdict.WA)
    calculate_score(user, c)

    data = client.get(reverse("contests-my-standing", args=[c.id])).json()
    assert data["solved"] == 1
    assert data["rank"] == 1
    statuses = {p["id"]: p["status"] for p in data["problems"]}
    assert statuses[solved.id] == "solved"
    assert statuses[attempted.id] == "attempted"
    assert statuses[untouched.id] == "open"


@pytest.mark.django_db
def test_my_standing_no_contestscore(client):
    c = _active_contest()
    p = _problem("A")
    c.problems.add(p)
    data = client.get(reverse("contests-my-standing", args=[c.id])).json()
    assert data["score"] == 0
    assert data["solved"] == 0
    assert data["rank"] is None
    assert data["problems"][0]["status"] == "open"


@pytest.mark.django_db
def test_leaderboard_rank_returns_none_when_user_absent(user):
    c = _active_contest()  # no ContestScore for anyone → empty leaderboard
    assert _leaderboard_rank(c, user.pk) is None


@pytest.mark.django_db
def test_my_standing_requires_auth():
    c = _active_contest()
    resp = APIClient().get(reverse("contests-my-standing", args=[c.id]))
    assert resp.status_code in (401, 403)
