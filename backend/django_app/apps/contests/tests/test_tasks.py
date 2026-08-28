"""Tests for the contests Celery tasks: the status refresh (plus its
``contest_ended`` broadcast) and the finished-contest rating batch."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import (
    _broadcast_contest_ended,
    apply_finished_contest_ratings,
    publish_finished_contest_problems,
    update_contest_statuses,
)
from apps.problems.models import Problem
from django.utils import timezone
from factories import make_contest, make_problem, make_submission

# users, problems, finished_contest come from conftest.


# --- update_contest_statuses -----------------------------------------------


@pytest.mark.django_db
def test_update_contest_statuses_in_bulk():
    """One run fixes all three transitions at once."""
    now = timezone.now()
    pending = Contest.objects.create(
        title="Pending",
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=2),
    )
    active = Contest.objects.create(
        title="Active",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
    )
    finished = Contest.objects.create(
        title="Finished",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
    )
    # save() already stored the correct status on each, so plant stale ones
    # behind its back — otherwise the task would have nothing to do.
    Contest.objects.filter(pk=pending.pk).update(status=Contest.Status.FINISHED)
    Contest.objects.filter(pk=active.pk).update(status=Contest.Status.PENDING)
    Contest.objects.filter(pk=finished.pk).update(status=Contest.Status.ACTIVE)

    with (
        patch("apps.contests.tasks.Redis"),
        patch("channels.layers.get_channel_layer", return_value=None),
    ):
        summary = update_contest_statuses()

    assert summary["db_updated"] == {"finished": 1, "active": 1, "pending": 1}
    for contest, expected in (
        (pending, Contest.Status.PENDING),
        (active, Contest.Status.ACTIVE),
        (finished, Contest.Status.FINISHED),
    ):
        contest.refresh_from_db()
        assert contest.status == expected


@pytest.mark.django_db
def test_update_contest_statuses_does_not_broadcast_ended():
    """
    The status sweep flips a contest to FINISHED but must NOT send contest_ended.

    Since Step 9 the event rides with apply_finished_contest_ratings — "time is
    up" is not "final results are in", so the socket stays open until ELO lands.
    The assert_not_called guards that: if the broadcast is ever put back into the
    status task, this test fails instead of silently passing.

    Also covers the empty-Redis else branch: delta = dict(total_current) runs
    when Redis has no previous data for the key.
    """
    now = timezone.now()
    contest = Contest.objects.create(
        title="Active→Finished",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
    )
    # save() auto-set status=FINISHED; force it back to ACTIVE so the task
    # actually has work to do (finished_updated > 0).
    Contest.objects.filter(pk=contest.pk).update(status=Contest.Status.ACTIVE)

    fake_redis = MagicMock()
    fake_redis.hgetall.return_value = {}  # empty → else branch is taken

    with (
        patch("apps.contests.tasks.Redis") as mock_redis_cls,
        patch("apps.contests.tasks._broadcast_contest_ended") as broadcast,
    ):
        mock_redis_cls.from_url.return_value = fake_redis
        update_contest_statuses()

    contest.refresh_from_db()
    assert contest.status == Contest.Status.FINISHED
    broadcast.assert_not_called()  # the event belongs to the ratings task now


# --- contest_ended broadcast -----------------------------------------------


@pytest.mark.django_db
def test_broadcast_contest_ended_no_channel_layer():
    """When no channel layer is configured, the function returns silently."""
    with patch("channels.layers.get_channel_layer", return_value=None):
        # Should not raise
        _broadcast_contest_ended([1, 2, 3])


@pytest.mark.django_db
def test_broadcast_contest_ended_sends_to_each_contest():
    """Each contest_id gets a 'contest_ended' message sent to its group."""
    sent = []

    fake_layer = MagicMock()

    def fake_async_to_sync(coro_fn):
        """Replace async_to_sync with a sync recorder."""

        def sync_sender(group, message):
            sent.append((group, message))

        return sync_sender

    with (
        patch("channels.layers.get_channel_layer", return_value=fake_layer),
        patch("asgiref.sync.async_to_sync", side_effect=fake_async_to_sync),
    ):
        _broadcast_contest_ended([10, 20])

    assert ("contest_10", {"type": "contest_ended"}) in sent
    assert ("contest_20", {"type": "contest_ended"}) in sent


# --- apply_finished_contest_ratings ----------------------------------------


@pytest.mark.django_db
def test_ratings_isolate_failing_contest(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    # One bad contest must not crash the batch.
    with patch(
        "apps.contests.services.apply_contest_ratings", side_effect=RuntimeError("boom")
    ):
        summary = apply_finished_contest_ratings()  # must not raise

    assert summary["contests_processed"] == 0  # the failing one wasn't counted
    c.refresh_from_db()
    assert c.rating_applied is False  # left for the next run


@pytest.mark.django_db
def test_ratings_pick_finished_unrated_only(users, problems, finished_contest):
    a, b, _ = users
    now = timezone.now()

    finished = finished_contest
    make_submission(a, problems[0], finished)
    make_submission(b, problems[0], finished)

    Contest.objects.create(  # finished, but already rated → skipped
        title="Already rated",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
        rating_applied=True,
    )

    active = Contest.objects.create(
        title="Active",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
    )
    make_submission(a, problems[0], active)
    make_submission(b, problems[0], active)

    summary = apply_finished_contest_ratings()

    assert summary["contests_processed"] == 1  # only `finished`
    assert summary["participants_updated"] == 2
    finished.refresh_from_db()
    active.refresh_from_db()
    assert finished.rating_applied is True
    assert active.rating_applied is False  # not finished → untouched


# --- publish_finished_contest_problems -------------------------------------


@pytest.mark.django_db
def test_finished_contest_puts_its_problems_in_the_catalog():
    contest = make_contest("Done", starts_in=-3, ends_in=-1)
    problem = make_problem("Hidden", is_hidden=True)
    contest.problems.add(problem)

    assert publish_finished_contest_problems() == {"published": 1}
    problem.refresh_from_db()
    assert problem.is_hidden is False


@pytest.mark.django_db
def test_problems_of_a_round_still_ahead_stay_hidden():
    for title, starts_in, ends_in in [("Live", -1, 1), ("Upcoming", 1, 2)]:
        contest = make_contest(title, starts_in=starts_in, ends_in=ends_in)
        contest.problems.add(make_problem(title, is_hidden=True))

    assert publish_finished_contest_problems() == {"published": 0}
    assert Problem.objects.filter(is_hidden=True).count() == 2


@pytest.mark.django_db
def test_second_run_has_nothing_left_to_do():
    contest = make_contest("Done", starts_in=-3, ends_in=-1)
    contest.problems.add(make_problem("Hidden", is_hidden=True))

    publish_finished_contest_problems()
    assert publish_finished_contest_problems() == {"published": 0}
