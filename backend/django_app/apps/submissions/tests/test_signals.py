"""Tests for the submission verdict signals.

Covers the ``channel_layer is None`` early-return branches, the verdict-changed
guard, and the bust-then-signal ordering the leaderboard cache relies on.
"""

from unittest.mock import patch

import pytest
from apps.submissions.models import Submission
from apps.submissions.signals import (
    _broadcast_submission_update,
    _signal_leaderboard_changed,
)
from factories import make_submission

# user, problem and active_contest come from conftest.


@pytest.mark.django_db
def test_signal_leaderboard_changed_no_channel_layer(active_contest):
    """_signal_leaderboard_changed returns silently without a channel layer."""
    with patch("channels.layers.get_channel_layer", return_value=None):
        _signal_leaderboard_changed(active_contest)  # should not raise


@pytest.mark.django_db
def test_broadcast_submission_update_no_channel_layer(user, problem):
    """_broadcast_submission_update returns silently when channel layer is None."""
    submission = make_submission(user, problem, verdict=None)
    with patch("channels.layers.get_channel_layer", return_value=None):
        _broadcast_submission_update(submission)  # should not raise


@pytest.mark.django_db
def test_broadcast_verdict_update_skipped_when_verdict_unchanged(user, problem):
    """No broadcast when verdict did not change between saves."""
    submission = make_submission(user, problem, verdict=Submission.Verdict.WA)
    with patch(
        "apps.submissions.signals._broadcast_submission_update"
    ) as mock_broadcast:
        submission.save()  # saved again, same verdict
        mock_broadcast.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_repeat_ac_on_the_same_problem_is_a_no_op(user, problem, active_contest):
    """Solving an already-solved problem must not re-signal.

    Without the guard every later AC on the same problem would bust the cache
    and wake every viewer for standings that did not move.
    """
    active_contest.participants.add(user)
    submission = make_submission(user, problem, active_contest, Submission.Verdict.AC)

    with patch("apps.submissions.signals.group_send") as send:
        submission.save()  # saved again, still AC
        send.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_ac_busts_the_cache_before_it_signals(user, problem, active_contest):
    """Order matters: clients refetch the instant the signal lands, so a stale
    page must already be gone. Bust has to run before the signal."""
    active_contest.participants.add(user)

    calls = []
    with (
        patch(
            "apps.submissions.signals.bust_leaderboard_cache",
            side_effect=lambda cid: calls.append("bust"),
        ),
        patch(
            "apps.submissions.signals.group_send",
            side_effect=lambda *a, **kw: calls.append("signal"),
        ),
    ):
        make_submission(user, problem, active_contest, Submission.Verdict.AC)

    assert calls[:2] == ["bust", "signal"]
