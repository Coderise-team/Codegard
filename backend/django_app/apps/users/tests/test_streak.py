"""Tests for the streak endpoint GET /api/users/{username}/streak/."""

from datetime import datetime, time, timedelta

import pytest
from apps.problems.models import DailyProblem, Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


def _problem(title):
    return Problem.objects.create(
        title=title,
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


def _assign(date, problem):
    return DailyProblem.objects.create(date=date, problem=problem)


def _solve(user, problem, date):
    """Create an AC submission dated on `date` (UTC noon)."""
    s = Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=Submission.Verdict.AC,
    )
    when = timezone.make_aware(datetime.combine(date, time(12, 0)))
    Submission.objects.filter(pk=s.pk).update(created_at=when)
    return s


def url(username):
    return reverse("users:user-streak", args=[username])


# --- access -----------------------------------------------------------------


@pytest.mark.django_db
def test_anonymous_gets_401(api_client, user):
    assert api_client.get(url(user.username)).status_code == 401


@pytest.mark.django_db
def test_unknown_username_404(auth_client):
    assert auth_client.get(url("ghost")).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_any_authenticated_sees_others_streak(api_client, user, django_user_model):
    viewer = django_user_model.objects.create_user(
        username="viewer", email="v@test.com", password="pass"
    )
    api_client.force_authenticate(user=viewer)
    assert api_client.get(url(user.username)).status_code == 200


# --- current_streak ---------------------------------------------------------


@pytest.mark.django_db
def test_current_streak_counts_consecutive_days(auth_client, user):
    today = timezone.now().date()
    for offset in range(3):  # today, yesterday, day before
        d = today - timedelta(days=offset)
        p = _problem(f"P{offset}")
        _assign(d, p)
        _solve(user, p, d)
    assert auth_client.get(url(user.username)).json()["current_streak"] == 3


@pytest.mark.django_db
def test_today_unsolved_does_not_break(auth_client, user):
    today = timezone.now().date()
    # yesterday + day before solved; today assigned but unsolved.
    for offset in (1, 2):
        d = today - timedelta(days=offset)
        p = _problem(f"P{offset}")
        _assign(d, p)
        _solve(user, p, d)
    _assign(today, _problem("Ptoday"))  # unsolved
    assert auth_client.get(url(user.username)).json()["current_streak"] == 2


@pytest.mark.django_db
def test_gap_in_middle_breaks(auth_client, user):
    today = timezone.now().date()
    # today and yesterday solved; day before (offset 2) missed.
    for offset in (0, 1, 3):
        d = today - timedelta(days=offset)
        p = _problem(f"P{offset}")
        _assign(d, p)
        _solve(user, p, d)
    # offset 2 assigned but not solved (a gap right below the chain)
    _assign(today - timedelta(days=2), _problem("gap"))
    assert auth_client.get(url(user.username)).json()["current_streak"] == 2


# --- strict crediting -------------------------------------------------------


@pytest.mark.django_db
def test_solving_different_problem_does_not_count(auth_client, user):
    today = timezone.now().date()
    daily = _problem("daily")
    _assign(today, daily)
    _solve(user, _problem("other"), today)  # solved a different problem
    body = auth_client.get(url(user.username)).json()
    assert body["current_streak"] == 0


@pytest.mark.django_db
def test_solving_daily_problem_on_other_day_does_not_count(auth_client, user):
    today = timezone.now().date()
    p = _problem("daily")
    _assign(today, p)
    _solve(user, p, today - timedelta(days=1))  # right problem, wrong day
    assert auth_client.get(url(user.username)).json()["current_streak"] == 0


# --- longest_streak ---------------------------------------------------------


@pytest.mark.django_db
def test_longest_streak_independent_of_current(auth_client, user):
    today = timezone.now().date()
    # Past record: 4 consecutive days, 10..13 days ago.
    for offset in range(10, 14):
        d = today - timedelta(days=offset)
        p = _problem(f"old{offset}")
        _assign(d, p)
        _solve(user, p, d)
    # Current: just today.
    p_today = _problem("today")
    _assign(today, p_today)
    _solve(user, p_today, today)

    body = auth_client.get(url(user.username)).json()
    assert body["current_streak"] == 1
    assert body["longest_streak"] == 4


# --- history ----------------------------------------------------------------


@pytest.mark.django_db
def test_history_shape(auth_client, user):
    today = timezone.now().date()
    p = _problem("daily")
    _assign(today, p)  # assigned, unsolved → today cell is "today"
    body = auth_client.get(url(user.username)).json()
    history = body["history"]
    assert len(history) == 14
    assert history[0]["date"] == (today - timedelta(days=13)).isoformat()
    assert history[-1]["date"] == today.isoformat()
    assert history[-1]["status"] == "today"


@pytest.mark.django_db
def test_history_today_solved_is_solved(auth_client, user):
    today = timezone.now().date()
    p = _problem("daily")
    _assign(today, p)
    _solve(user, p, today)
    history = auth_client.get(url(user.username)).json()["history"]
    assert history[-1]["status"] == "solved"


@pytest.mark.django_db
def test_empty_history(auth_client, user):
    body = auth_client.get(url(user.username)).json()
    assert body["current_streak"] == 0
    assert body["longest_streak"] == 0
    assert len(body["history"]) == 14
    assert all(c["status"] == "missed" for c in body["history"][:-1])
    assert body["history"][-1]["status"] == "today"
