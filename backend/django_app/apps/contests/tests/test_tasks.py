from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import _broadcast_contest_ended, update_contest_statuses
from django.utils import timezone


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
