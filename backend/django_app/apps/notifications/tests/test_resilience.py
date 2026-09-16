"""What happens when the notification side fails.

Notifications ride along with work that matters more — rating a contest,
saving a problem, refreshing contest statuses. These tests pin down that a
failure on the notification side stays on the notification side: a Redis
outage is logged and forgotten rather than raised into the caller, and a failed
announcement never takes down the task it rides with.

They use real transactions (``transaction=True``) on purpose: the doorbell runs
from ``on_commit``, and only a real commit shows what an exception there does.
"""

from unittest.mock import patch

import apps.notifications.services as services
import pytest
from apps.contests.tasks import apply_finished_contest_ratings, update_contest_statuses
from apps.notifications.models import Notification
from apps.problems.models import Problem
from apps.submissions.models import Submission
from factories import make_contest, make_problem, make_submission, make_user


class RedisDown:
    """A channel layer whose every send fails, counting the attempts."""

    def __init__(self):
        self.attempts = 0

    async def group_send(self, group, message):
        self.attempts += 1
        raise ConnectionError("redis is down")


# --- a Redis outage is contained ------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_rating_a_contest_still_announces_its_end_when_redis_is_down():
    """The ratings commit before the doorbell rings. An unhandled failure there
    used to abort the batch before `contest_ended` was created — and because the
    contest was already marked rated, no later run would ever create it."""
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    problem = make_problem("Two Sum")
    contest.problems.add(problem)
    winner = make_user("winner", 1200)
    loser = make_user("loser", 1200)
    contest.participants.add(winner, loser)
    make_submission(winner, problem, contest, Submission.Verdict.AC)
    make_submission(loser, problem, contest, Submission.Verdict.WA)

    with patch("channels.layers.get_channel_layer", return_value=RedisDown()):
        apply_finished_contest_ratings()

    assert Notification.objects.filter(type=Notification.Type.RATING_CHANGED).exists()
    assert (
        Notification.objects.filter(type=Notification.Type.CONTEST_ENDED).count() == 2
    )


@pytest.mark.django_db(transaction=True)
def test_publishing_a_problem_does_not_fail_when_redis_is_down():
    """The problem is saved before the doorbell rings, so a Redis error must not
    reach the admin as a 500 for a save that actually went through."""
    make_user("member", 1200)

    with patch("channels.layers.get_channel_layer", return_value=RedisDown()):
        make_problem("Two Sum", is_hidden=False)  # must not raise

    assert Problem.objects.filter(title="Two Sum").exists()
    assert Notification.objects.filter(type=Notification.Type.NEW_PROBLEM).exists()


@pytest.mark.django_db(transaction=True)
def test_one_failed_doorbell_does_not_silence_the_rest():
    """Every recipient is still tried: the first failure used to skip them all."""
    for i in range(5):
        make_user(f"member{i}", 1200)
    layer = RedisDown()

    with patch("channels.layers.get_channel_layer", return_value=layer):
        make_problem("Two Sum", is_hidden=False)

    assert layer.attempts == 5


# --- a failed announcement does not take the status task down --------------


@pytest.mark.django_db(transaction=True)
def test_the_status_task_survives_a_failed_announcement():
    """Statuses are this task's real job. A failing announcement is logged and
    the task still finishes and reports; the contest is still running, so the
    next minute's run delivers the announcement."""
    contest = make_contest("Round 1", starts_in=-1, ends_in=1)
    entrant = make_user("entrant", 1200)
    contest.participants.add(entrant)

    with (
        patch("apps.contests.tasks.Redis"),
        patch.object(services, "create_bulk", side_effect=RuntimeError("db blip")),
    ):
        summary = update_contest_statuses()  # must not raise

    assert summary["total_current"]["active"] == 1

    with (
        patch("apps.contests.tasks.Redis"),
        patch("channels.layers.get_channel_layer", return_value=None),
    ):
        update_contest_statuses()

    assert Notification.objects.filter(
        user=entrant, type=Notification.Type.CONTEST_STARTED
    ).exists()
