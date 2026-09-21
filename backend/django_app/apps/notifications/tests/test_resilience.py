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
from apps.contests.tasks import (
    apply_finished_contest_ratings,
    publish_finished_contest_problems,
    update_contest_statuses,
)
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
def test_an_unreachable_redis_is_tried_once_not_once_per_person():
    """A real unreachable Redis spends about four seconds on every send before
    it gives up, and the rings go one after another. Trying everyone would hold
    the admin's request for four seconds per person, so the first failure ends
    the run: one attempt, however many people are waiting."""
    for i in range(5):
        make_user(f"member{i}", 1200)
    layer = RedisDown()

    with patch("channels.layers.get_channel_layer", return_value=layer):
        make_problem("Two Sum", is_hidden=False)

    assert layer.attempts == 1
    # Nothing is lost: every notification is already saved for the next fetch.
    assert Notification.objects.filter(type=Notification.Type.NEW_PROBLEM).count() == 5


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


# --- a failed announcement is retried, not lost ----------------------------


def _fail_once(real, type):
    """A stand-in for `create_bulk` that raises the first time it is asked to
    create `type`, and behaves normally from then on."""
    state = {"failed": False}

    def flaky(*args, **kwargs):
        if kwargs.get("type") == type and not state["failed"]:
            state["failed"] = True
            raise RuntimeError("db blip")
        return real(*args, **kwargs)

    return flaky


@pytest.mark.django_db(transaction=True)
def test_a_failed_contest_end_announcement_is_retried_with_the_rating():
    """Rating and announcement commit together, so a failed announcement rolls
    the rating back and the next run redoes both — instead of leaving a rated
    contest that no run would ever announce."""
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    problem = make_problem("Two Sum")
    contest.problems.add(problem)
    winner = make_user("winner", 1200)
    loser = make_user("loser", 1200)
    contest.participants.add(winner, loser)
    make_submission(winner, problem, contest, Submission.Verdict.AC)
    make_submission(loser, problem, contest, Submission.Verdict.WA)
    flaky = _fail_once(services.create_bulk, Notification.Type.CONTEST_ENDED)

    with (
        patch("channels.layers.get_channel_layer", return_value=None),
        patch.object(services, "create_bulk", side_effect=flaky),
    ):
        apply_finished_contest_ratings()

        contest.refresh_from_db()
        winner.refresh_from_db()
        assert contest.rating_applied is False  # rolled back, not stranded
        assert winner.elo_rating == 1200  # no half-applied rating either

        apply_finished_contest_ratings()

    contest.refresh_from_db()
    assert contest.rating_applied is True
    assert (
        Notification.objects.filter(type=Notification.Type.CONTEST_ENDED).count() == 2
    )


@pytest.mark.django_db(transaction=True)
def test_a_failed_new_problem_announcement_keeps_the_problem_hidden_until_retried():
    """Reveal and announcement commit together, so a failed announcement leaves
    the problem hidden and the next run publishes and announces it — instead of
    a visible problem the task can no longer find."""
    make_user("member", 1200)
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    contest.problems.add(make_problem("Alpha", is_hidden=True))
    flaky = _fail_once(services.create_bulk, Notification.Type.NEW_PROBLEM)

    with (
        patch("channels.layers.get_channel_layer", return_value=None),
        patch.object(services, "create_bulk", side_effect=flaky),
    ):
        with pytest.raises(RuntimeError):
            publish_finished_contest_problems()

        assert Problem.objects.get(title="Alpha").is_hidden is True  # rolled back

        publish_finished_contest_problems()

    assert Problem.objects.get(title="Alpha").is_hidden is False
    assert Notification.objects.filter(type=Notification.Type.NEW_PROBLEM).exists()
