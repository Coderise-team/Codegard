"""Tests for the assign_daily_problem beat task."""

from datetime import timedelta

import pytest
from apps.problems.models import DailyProblem
from apps.problems.tasks import RECENT_DAYS, assign_daily_problem
from django.utils import timezone
from factories import make_problem


@pytest.mark.django_db
def test_creates_one_for_today():
    p = make_problem("P")
    summary = assign_daily_problem()
    assert summary["created"] is True
    today = timezone.now().date()
    assert DailyProblem.objects.filter(date=today, problem=p).exists()


@pytest.mark.django_db
def test_idempotent_second_call_no_change():
    make_problem("A")
    make_problem("B")
    assign_daily_problem()
    first = DailyProblem.objects.get(date=timezone.now().date())

    summary = assign_daily_problem()
    assert summary["created"] is False
    assert DailyProblem.objects.count() == 1
    assert DailyProblem.objects.get(date=timezone.now().date()).problem_id == (
        first.problem_id
    )


@pytest.mark.django_db
def test_avoids_recently_used():
    today = timezone.now().date()
    recent = make_problem("recent")
    fresh = make_problem("fresh")
    # `recent` was daily yesterday → must not be picked today.
    DailyProblem.objects.create(date=today - timedelta(days=1), problem=recent)

    assign_daily_problem()
    assert DailyProblem.objects.get(date=today).problem_id == fresh.id


@pytest.mark.django_db
def test_fallback_picks_least_recently_used_when_pool_exhausted():
    today = timezone.now().date()
    p_old = make_problem("old")
    p_new = make_problem("new")
    # Both used within the window; p_old's last use is older → LRU pick.
    DailyProblem.objects.create(date=today - timedelta(days=3), problem=p_old)
    DailyProblem.objects.create(date=today - timedelta(days=1), problem=p_new)
    assert RECENT_DAYS >= 3  # both fall inside the window

    summary = assign_daily_problem()
    assert summary["created"] is True
    assert DailyProblem.objects.get(date=today).problem_id == p_old.id


@pytest.mark.django_db
def test_no_problems_creates_nothing():
    summary = assign_daily_problem()
    assert summary == {"created": False, "reason": "no problems"}
    assert not DailyProblem.objects.exists()


@pytest.mark.django_db
def test_hidden_problems_are_never_picked():
    # The daily challenge publishes the statement to everyone, so a problem
    # saved for a contest must stay out of the draw.
    make_problem("hidden", is_hidden=True)
    published = make_problem("published")

    assign_daily_problem()
    assert DailyProblem.objects.get(date=timezone.now().date()).problem_id == (
        published.id
    )


@pytest.mark.django_db
def test_only_hidden_problems_assigns_nothing():
    # Including the fallback branch: an exhausted pool must not reach for a
    # hidden problem either.
    make_problem("hidden", is_hidden=True)

    summary = assign_daily_problem()
    assert summary == {"created": False, "reason": "no problems"}
    assert not DailyProblem.objects.exists()
