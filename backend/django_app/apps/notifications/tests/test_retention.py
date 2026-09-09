"""The retention sweep.

Two thresholds that must not bleed into each other: something already seen goes
after 30 days, something never seen is kept for 90. The tests pin both edges,
because getting either wrong is invisible until a reader loses a notification
they never read.
"""

from datetime import timedelta

import pytest
from apps.notifications.models import Notification
from apps.notifications.tasks import (
    SEEN_RETENTION_DAYS,
    UNSEEN_RETENTION_DAYS,
    cleanup_old_notifications,
)
from django.utils import timezone
from factories import make_notification

# user comes from conftest.


def days_ago(days):
    return timezone.now() - timedelta(days=days)


# --- the seen threshold ----------------------------------------------------


@pytest.mark.django_db
def test_something_seen_long_ago_is_dropped(user):
    make_notification(user, dedup_key="old", seen_at=days_ago(SEEN_RETENTION_DAYS + 1))

    cleanup_old_notifications()

    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_something_seen_recently_is_kept(user):
    make_notification(user, dedup_key="new", seen_at=days_ago(SEEN_RETENTION_DAYS - 1))

    cleanup_old_notifications()

    assert Notification.objects.count() == 1


@pytest.mark.django_db
def test_the_last_minute_inside_the_seen_window_survives(user):
    """A minute short of the threshold is still inside it.

    Not "exactly at the threshold": the row is stamped a hair before the task
    reads its own clock, so an exact boundary cannot be built in a test — it
    would always land a few microseconds on the far side.
    """
    make_notification(
        user,
        dedup_key="edge",
        seen_at=days_ago(SEEN_RETENTION_DAYS) + timedelta(minutes=1),
    )

    cleanup_old_notifications()

    assert Notification.objects.count() == 1


# --- the unseen threshold --------------------------------------------------


@pytest.mark.django_db
def test_something_never_seen_is_dropped_eventually(user):
    make_notification(
        user, dedup_key="ancient", created_at=days_ago(UNSEEN_RETENTION_DAYS + 1)
    )

    cleanup_old_notifications()

    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_something_never_seen_is_given_longer(user):
    """Older than the seen threshold, but still owed to a reader who has not
    looked — the two windows are independent."""
    make_notification(
        user, dedup_key="unread", created_at=days_ago(SEEN_RETENTION_DAYS + 10)
    )

    cleanup_old_notifications()

    assert Notification.objects.count() == 1


@pytest.mark.django_db
def test_the_last_minute_inside_the_unseen_window_survives(user):
    make_notification(
        user,
        dedup_key="edge",
        created_at=days_ago(UNSEEN_RETENTION_DAYS) + timedelta(minutes=1),
    )

    cleanup_old_notifications()

    assert Notification.objects.count() == 1


# --- the two passes together -----------------------------------------------


@pytest.mark.django_db
def test_the_sweep_keeps_what_it_should_and_reports_the_rest(user):
    make_notification(user, dedup_key="a", seen_at=days_ago(SEEN_RETENTION_DAYS + 1))
    make_notification(user, dedup_key="b", seen_at=days_ago(SEEN_RETENTION_DAYS + 5))
    make_notification(
        user, dedup_key="c", created_at=days_ago(UNSEEN_RETENTION_DAYS + 1)
    )
    survivor = make_notification(user, dedup_key="d")

    summary = cleanup_old_notifications()

    assert summary == {"seen_deleted": 2, "unseen_deleted": 1}
    assert list(Notification.objects.all()) == [survivor]


@pytest.mark.django_db
def test_a_row_seen_late_in_its_life_goes_by_when_it_was_seen(user):
    """Created long ago but only read yesterday: the seen clock is what counts,
    and it has barely started."""
    make_notification(
        user,
        dedup_key="late",
        created_at=days_ago(UNSEEN_RETENTION_DAYS + 30),
        seen_at=days_ago(1),
    )

    cleanup_old_notifications()

    assert Notification.objects.count() == 1


@pytest.mark.django_db
def test_a_quiet_sweep_costs_nothing(db):
    assert cleanup_old_notifications() == {"seen_deleted": 0, "unseen_deleted": 0}
