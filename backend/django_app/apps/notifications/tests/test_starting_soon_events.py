"""The contest_starting_soon beat task.

Two things make this task different from the other sources. Its audience is
every active user rather than a contest's own participants — registration
closes at the start, so the notification exists to get someone *into* the round
— and it runs every minute against a fifteen-minute window, which means one
contest is selected on about fifteen consecutive runs. Only the first of those
may write or ring; the rest are the reason the creation service subtracts
before it inserts.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.tasks import (
    STARTING_SOON_MINUTES,
    notify_contests_starting_soon,
)
from apps.notifications.models import Notification
from django.utils import timezone
from factories import make_contest, make_user


def soon_for(user):
    return Notification.objects.filter(
        user=user, type=Notification.Type.CONTEST_STARTING_SOON
    )


def contest_starting_in(minutes, title="Round 1"):
    """A contest whose start is `minutes` away, lasting two hours."""
    hours = minutes / 60
    return make_contest(title, starts_in=hours, ends_in=hours + 2)


# --- the window ------------------------------------------------------------


@pytest.mark.django_db
def test_a_contest_about_to_start_is_announced(db):
    contest = contest_starting_in(10)
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    notification = soon_for(member).get()
    assert notification.title == "Contest starting soon"
    assert notification.body == "Round 1 starts in ~10 min"  # the real time left
    assert notification.link == f"/contests/{contest.pk}"


@pytest.mark.django_db
def test_the_far_edge_of_the_window_is_included(db):
    """Exactly fifteen minutes out still counts as soon."""
    contest_starting_in(STARTING_SOON_MINUTES)
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    assert soon_for(member).exists()


@pytest.mark.django_db
def test_a_contest_beyond_the_window_waits_its_turn(db):
    contest_starting_in(STARTING_SOON_MINUTES + 5)
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    assert not soon_for(member).exists()


@pytest.mark.django_db
def test_a_contest_that_already_began_is_not_announced_as_upcoming(db):
    """Past the start nobody can join, and `contest_started` owns that moment."""
    make_contest("Running", starts_in=-1, ends_in=1)
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    assert not soon_for(member).exists()


# --- who hears it ----------------------------------------------------------


@pytest.mark.django_db
def test_everyone_active_hears_it_not_only_the_registered(db):
    """The whole point: registration closes at the start, so this is aimed at
    the people who have not signed up yet."""
    contest = contest_starting_in(10)
    registered = make_user("registered", 1200)
    outsider = make_user("outsider", 1200)
    contest.participants.add(registered)

    notify_contests_starting_soon()

    assert soon_for(registered).exists()
    assert soon_for(outsider).exists()


@pytest.mark.django_db
def test_a_deactivated_account_is_skipped(db):
    contest_starting_in(10)
    disabled = make_user("disabled", 1200, is_active=False)

    notify_contests_starting_soon()

    assert not soon_for(disabled).exists()


# --- the repeat runs -------------------------------------------------------


@pytest.mark.django_db
def test_fifteen_minutes_of_runs_produce_one_notification(db):
    contest_starting_in(10)
    member = make_user("member", 1200)

    for _ in range(5):
        notify_contests_starting_soon()

    assert soon_for(member).count() == 1


@pytest.mark.django_db
def test_only_the_first_run_rings(db, django_capture_on_commit_callbacks):
    """The fourteen idle runs must be completely silent."""
    contest_starting_in(10)
    member = make_user("member", 1200)

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            notify_contests_starting_soon()
    assert [call.args[0] for call in ring.call_args_list] == [member.pk]

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            notify_contests_starting_soon()
    ring.assert_not_called()


@pytest.mark.django_db
def test_a_start_the_admin_moved_is_announced_again(db):
    contest = contest_starting_in(10)
    member = make_user("member", 1200)
    notify_contests_starting_soon()

    contest.start_time = timezone.now() + timedelta(minutes=5)
    contest.save(update_fields=["start_time"])
    notify_contests_starting_soon()

    assert soon_for(member).count() == 2


# --- the summary -----------------------------------------------------------


@pytest.mark.django_db
def test_the_task_reports_what_it_did(db):
    contest_starting_in(10)
    make_user("a", 1200)
    make_user("b", 1200)

    first = notify_contests_starting_soon()
    second = notify_contests_starting_soon()

    assert first == {"contests_announced": 1, "users_notified": 2}
    assert second == {"contests_announced": 0, "users_notified": 0}


@pytest.mark.django_db
def test_a_quiet_schedule_costs_nothing(db):
    make_user("member", 1200)

    assert notify_contests_starting_soon() == {
        "contests_announced": 0,
        "users_notified": 0,
    }


# --- the reminder tells the truth about the time -------------------------


@pytest.mark.django_db
def test_a_contest_entering_the_window_late_is_not_called_fifteen_minutes(db):
    """A contest created two minutes before its start is two minutes away.

    The body used to print the window constant, so this case announced
    "starts in ~15 min" for a round about to begin.
    """
    contest_starting_in(2)
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    assert soon_for(member).get().body == "Round 1 starts in ~2 min"


@pytest.mark.django_db
def test_a_contest_seconds_away_never_says_zero(db):
    contest_starting_in(0.2)  # 12 seconds
    member = make_user("member", 1200)

    notify_contests_starting_soon()

    assert soon_for(member).get().body == "Round 1 starts in ~1 min"


# --- what an idle run costs ------------------------------------------------


@pytest.mark.django_db
def test_an_idle_run_does_not_read_the_user_table(db, django_assert_num_queries):
    """Nothing is starting soon - the task must not scan every active user.

    It runs every minute and the window is empty almost all the time, so the
    audience is fetched only once there is something to announce.
    """
    for i in range(3):
        make_user(f"u{i}", 1200)

    with django_assert_num_queries(1):  # the contest lookup, and nothing else
        notify_contests_starting_soon()
