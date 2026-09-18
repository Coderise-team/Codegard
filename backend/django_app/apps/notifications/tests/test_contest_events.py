"""Notifications emitted by the contest lifecycle tasks.

Source: ``contests.tasks``. The delicate one is ``contest_started``, which
rides along with the status refresh — a task that runs every minute against a
contest that stays running for hours, so the same event is offered over and
over and only the dedup key stands between participants and a flood.

That key carries the start time, which makes it answer two questions at once:
a repeat at the same start time is a bug (two beat copies, a restarted worker)
and stays silent, while a start the admin moved is real news and goes out again.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import update_contest_statuses
from apps.notifications.models import Notification
from django.utils import timezone
from factories import make_contest, make_user


@pytest.fixture
def running_contest(db):
    """A contest in the middle of its window."""
    return make_contest("Round 1", starts_in=-1, ends_in=1)


def run_task():
    """The status task with Redis and the channel layer stubbed out."""
    with (
        patch("apps.contests.tasks.Redis"),
        patch("channels.layers.get_channel_layer", return_value=None),
    ):
        return update_contest_statuses()


def started_for(user):
    return Notification.objects.filter(
        user=user, type=Notification.Type.CONTEST_STARTED
    )


# --- who hears about it ----------------------------------------------------


@pytest.mark.django_db
def test_participants_are_told_the_round_is_live(running_contest):
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)

    run_task()

    notification = started_for(entrant).get()
    assert notification.title == "Contest started"
    assert notification.body == "Round 1 has started"
    assert notification.link == f"/contests/{running_contest.pk}"


@pytest.mark.django_db
def test_someone_who_did_not_register_is_left_alone(running_contest):
    bystander = make_user("bystander", 1200)

    run_task()

    assert not started_for(bystander).exists()


@pytest.mark.django_db
def test_a_contest_nobody_entered_does_not_break_the_run(running_contest):
    summary = run_task()

    assert Notification.objects.count() == 0
    assert summary["total_current"]["active"] == 1  # the task still did its job


# --- the clock decides, not the status column ------------------------------


@pytest.mark.django_db
def test_a_contest_stored_as_active_is_still_announced(running_contest):
    """The regression this whole filter exists for.

    ``Contest.save()`` recomputes the status, so a contest created inside its
    own window is ACTIVE the moment it is saved and the status refresh has
    nothing left to transition. Filtering announcements by that column would
    mean this contest is never announced to anyone.
    """
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)
    assert running_contest.status == Contest.Status.ACTIVE  # the premise

    summary = run_task()

    assert summary["db_updated"]["active"] == 0  # nothing to transition
    assert started_for(entrant).exists()  # announced anyway


@pytest.mark.django_db
def test_a_contest_that_has_not_started_says_nothing(db):
    upcoming = make_contest("Later", starts_in=1, ends_in=3)
    waiting = make_user("waiting", 1200)
    upcoming.participants.add(waiting)

    run_task()

    assert not started_for(waiting).exists()


@pytest.mark.django_db
def test_a_contest_that_is_over_says_nothing(db):
    past = make_contest("Earlier", starts_in=-3, ends_in=-1)
    veteran = make_user("veteran", 1200)
    past.participants.add(veteran)

    run_task()

    assert not started_for(veteran).exists()


# --- dedup: the same start is silent, a moved start is not -----------------


@pytest.mark.django_db
def test_a_running_contest_is_announced_exactly_once(running_contest):
    """The task runs every minute for the hours the contest lasts."""
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)

    run_task()
    run_task()
    run_task()

    assert started_for(entrant).count() == 1


@pytest.mark.django_db
def test_a_start_the_admin_moved_is_announced_again(running_contest):
    """A new start time is a new event — people are waiting to hear it."""
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)
    run_task()

    running_contest.start_time = timezone.now() - timedelta(minutes=20)
    running_contest.save(update_fields=["start_time"])
    run_task()

    assert started_for(entrant).count() == 2


@pytest.mark.django_db
def test_a_contest_revived_by_an_admin_does_not_repeat_itself(db):
    """FINISHED is reversible: editing the times can put a contest back on air.

    With the same start time that is not a new beginning, so it must stay quiet.
    """
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    entrant = make_user("entrant", 1200)
    contest.participants.add(entrant)
    contest.end_time = timezone.now() + timedelta(hours=1)  # back on air
    contest.save(update_fields=["end_time"])
    run_task()

    run_task()

    assert started_for(entrant).count() == 1


# --- the doorbell ----------------------------------------------------------


@pytest.mark.django_db
def test_every_participant_is_rung_once(
    running_contest, django_capture_on_commit_callbacks
):
    first = make_user("first", 1200)
    second = make_user("second", 1200)
    running_contest.participants.add(first, second)

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            run_task()

    rung = [call.args[0] for call in ring.call_args_list]
    assert sorted(rung) == sorted([first.pk, second.pk])


@pytest.mark.django_db
def test_the_idle_runs_ring_nobody(running_contest, django_capture_on_commit_callbacks):
    """Every minute for hours: only the first run may make a sound."""
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)
    run_task()

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            run_task()

    ring.assert_not_called()


# --- contest_ended ---------------------------------------------------------


def run_rating_batch():
    """The finished-contest rating batch with the channel layer stubbed out."""
    from apps.contests.tasks import apply_finished_contest_ratings

    with patch("channels.layers.get_channel_layer", return_value=None):
        return apply_finished_contest_ratings()


def ended_for(user):
    return Notification.objects.filter(user=user, type=Notification.Type.CONTEST_ENDED)


@pytest.fixture
def played_contest(db):
    """A finished contest with two entrants who both submitted."""
    from apps.submissions.models import Submission
    from factories import make_problem, make_submission

    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    problem = make_problem("Two Sum")
    contest.problems.add(problem)
    winner = make_user("winner", 1200)
    loser = make_user("loser", 1200)
    contest.participants.add(winner, loser)
    make_submission(winner, problem, contest, Submission.Verdict.AC)
    make_submission(loser, problem, contest, Submission.Verdict.WA)
    return contest, winner, loser


@pytest.mark.django_db
def test_participants_are_told_the_results_are_in(played_contest):
    contest, winner, _ = played_contest

    run_rating_batch()

    notification = ended_for(winner).get()
    assert notification.title == "Contest finished"
    assert notification.body == "Round 1 has ended — results are in"
    assert notification.link == f"/contests/{contest.pk}"


@pytest.mark.django_db
def test_an_entrant_who_never_submitted_still_hears_it_ended(db):
    """The one notification that reaches a no-show: they are not rated, so
    ``rating_changed`` never comes, and this is all they would ever get."""
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    no_show = make_user("noshow", 1200)
    contest.participants.add(no_show)

    run_rating_batch()

    assert ended_for(no_show).exists()


@pytest.mark.django_db
def test_the_end_is_announced_exactly_once(played_contest):
    """The batch re-runs, but a rated contest is skipped by `rating_applied`;
    the key holds the line even if that flag is cleared."""
    contest, winner, _ = played_contest
    run_rating_batch()

    contest.rating_applied = False
    contest.save(update_fields=["rating_applied"])
    run_rating_batch()

    assert ended_for(winner).count() == 1


@pytest.mark.django_db
def test_a_contest_still_running_is_not_declared_over(running_contest):
    entrant = make_user("entrant", 1200)
    running_contest.participants.add(entrant)

    run_rating_batch()

    assert not ended_for(entrant).exists()


@pytest.mark.django_db
def test_the_end_of_the_round_rings_every_participant(
    played_contest, django_capture_on_commit_callbacks
):
    _, winner, loser = played_contest

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            run_rating_batch()

    assert {call.args[0] for call in ring.call_args_list} == {winner.pk, loser.pk}
