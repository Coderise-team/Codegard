"""Tests for the contests Celery tasks: the status refresh (plus its
``contest_ended`` broadcast) and the finished-contest rating batch."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import (
    _broadcast_contest_ended,
    apply_finished_contest_ratings,
    update_contest_statuses,
)
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.utils import timezone


@pytest.fixture
def users(db, django_user_model):
    return [
        django_user_model.objects.create_user(
            username=f"u{i}", email=f"u{i}@t.com", password="pass"
        )
        for i in range(3)
    ]


@pytest.fixture
def problems(db):
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


def _finished_contest():
    now = timezone.now()
    return Contest.objects.create(
        title="Done",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
        status=Contest.Status.FINISHED,
    )


def _submit(user, problem, contest, verdict):
    # An AC submission fires the scoring signal → creates/updates ContestScore.
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


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
def test_update_contest_statuses_broadcasts_ended_and_handles_empty_redis():
    """
    Covers two hard-to-reach branches in update_contest_statuses:

    - Line 30: _broadcast_contest_ended is called when finished_updated > 0.
      Contest.save() auto-computes status, so we must bypass it with .update()
      to set a "wrong" status that the task will transition.

    - Line 59 (else branch): delta = dict(total_current) runs when Redis has
      no previous data for the key.
    """
    now = timezone.now()
    contest = Contest.objects.create(
        title="Active→Finished",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
    )
    # save() auto-set status=FINISHED; force it back to ACTIVE so the task
    # actually has work to do (finished_updated > 0 → line 30 is reached).
    Contest.objects.filter(pk=contest.pk).update(status=Contest.Status.ACTIVE)

    fake_redis = MagicMock()
    fake_redis.hgetall.return_value = {}  # empty → else branch (line 59) is taken

    with (
        patch("apps.contests.tasks.Redis") as mock_redis_cls,
        patch("channels.layers.get_channel_layer", return_value=None),
    ):
        mock_redis_cls.from_url.return_value = fake_redis
        update_contest_statuses()

    contest.refresh_from_db()
    assert contest.status == Contest.Status.FINISHED


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
def test_ratings_isolate_failing_contest(users, problems):
    a, b, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)

    # One bad contest must not crash the batch.
    with patch(
        "apps.contests.services.apply_contest_ratings", side_effect=RuntimeError("boom")
    ):
        summary = apply_finished_contest_ratings()  # must not raise

    assert summary["contests_processed"] == 0  # the failing one wasn't counted
    c.refresh_from_db()
    assert c.rating_applied is False  # left for the next run


@pytest.mark.django_db
def test_ratings_pick_finished_unrated_only(users, problems):
    a, b, _ = users
    now = timezone.now()

    finished = _finished_contest()
    _submit(a, problems[0], finished, Submission.Verdict.AC)
    _submit(b, problems[0], finished, Submission.Verdict.AC)

    already = _finished_contest()
    already.rating_applied = True
    already.save(update_fields=["rating_applied"])

    active = Contest.objects.create(
        title="Active",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        status=Contest.Status.ACTIVE,
    )
    _submit(a, problems[0], active, Submission.Verdict.AC)
    _submit(b, problems[0], active, Submission.Verdict.AC)

    summary = apply_finished_contest_ratings()

    assert summary["contests_processed"] == 1  # only `finished`
    assert summary["participants_updated"] == 2
    finished.refresh_from_db()
    active.refresh_from_db()
    assert finished.rating_applied is True
    assert active.rating_applied is False  # not finished → untouched
