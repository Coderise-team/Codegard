"""Tests for the contests models: status computation, the save() side effect,
the start<end constraint, one score per (user, contest), and __str__.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from django.db import IntegrityError
from django.utils import timezone

from .factories import make_contest

# --- _compute_status (pure, no DB) -----------------------------------------


def test_compute_status_maps_the_clock_to_a_status():
    now = timezone.now()
    c = Contest(
        title="C",
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=3),
    )
    assert c._compute_status(now) == Contest.Status.PENDING
    assert c._compute_status(now + timedelta(hours=2)) == Contest.Status.ACTIVE
    assert c._compute_status(now + timedelta(hours=4)) == Contest.Status.FINISHED


def test_compute_status_window_edges_are_active():
    start = timezone.now()
    end = start + timedelta(hours=2)
    c = Contest(title="C", start_time=start, end_time=end)
    assert c._compute_status(start) == Contest.Status.ACTIVE  # start is inclusive
    assert c._compute_status(end) == Contest.Status.ACTIVE  # end is inclusive


# --- save() recomputes status ----------------------------------------------


@pytest.mark.django_db
def test_save_overrides_the_given_status_with_the_clock():
    # Asked for FINISHED, but the window says the contest is live right now.
    c = make_contest(starts_in=-1, ends_in=1, status=Contest.Status.FINISHED)
    assert c.status == Contest.Status.ACTIVE


@pytest.mark.django_db
def test_save_sets_status_for_each_window():
    assert (
        make_contest("Pending", starts_in=1, ends_in=3).status == Contest.Status.PENDING
    )
    assert make_contest("Live", starts_in=-1, ends_in=1).status == Contest.Status.ACTIVE
    assert (
        make_contest("Done", starts_in=-3, ends_in=-1).status == Contest.Status.FINISHED
    )


# --- update_status() -------------------------------------------------------


@pytest.mark.django_db
def test_update_status_fixes_a_stale_value():
    c = make_contest("Done", starts_in=-3, ends_in=-1)
    # Go behind save()'s back so the row really holds a stale status.
    Contest.objects.filter(pk=c.pk).update(status=Contest.Status.ACTIVE)
    c.refresh_from_db()
    assert c.status == Contest.Status.ACTIVE

    c.update_status()

    c.refresh_from_db()
    assert c.status == Contest.Status.FINISHED


@pytest.mark.django_db
def test_update_status_does_not_write_when_already_correct(django_assert_num_queries):
    c = make_contest("Live", starts_in=-1, ends_in=1)
    assert c.status == Contest.Status.ACTIVE
    with django_assert_num_queries(0):  # the guard skips the UPDATE
        c.update_status()


# --- start < end constraint ------------------------------------------------


@pytest.mark.django_db
def test_end_before_start_is_rejected():
    with pytest.raises(IntegrityError):
        make_contest("Backwards", starts_in=2, ends_in=1)


@pytest.mark.django_db
def test_zero_length_contest_is_rejected():
    now = timezone.now()
    with pytest.raises(IntegrityError):
        Contest.objects.create(title="Zero", start_time=now, end_time=now)


# --- ContestScore ----------------------------------------------------------


@pytest.mark.django_db
def test_one_score_per_user_and_contest(user):
    c = make_contest()
    ContestScore.objects.create(user=user, contest=c)
    with pytest.raises(IntegrityError):
        ContestScore.objects.create(user=user, contest=c)


# --- __str__ ---------------------------------------------------------------


@pytest.mark.django_db
def test_contest_str_is_title_and_status():
    c = make_contest("Round 1", starts_in=-1, ends_in=1)
    assert str(c) == "Round 1 (active)"


@pytest.mark.django_db
def test_contest_score_str_carries_score_and_penalty(user):
    c = make_contest("Round 1")
    cs = ContestScore.objects.create(user=user, contest=c, score=120, penalty=20)
    assert str(cs) == f"{user} in {c} — score=120 penalty=20"
