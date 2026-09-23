"""Tests for the Notification model: the dedup constraint, field defaults,
ordering, and __str__.

The constraint is the interesting part — it is the whole delivery guarantee.
Beat tasks overlap and workers restart, so sources will offer the same event
more than once on purpose; these tests pin down that the database is what
refuses the duplicate, not the caller's own bookkeeping.
"""

from datetime import timedelta

import pytest
from apps.notifications.models import Notification
from django.db import IntegrityError
from django.utils import timezone
from factories import make_notification, make_user

# --- the dedup constraint --------------------------------------------------


@pytest.mark.django_db
def test_same_user_type_and_key_cannot_be_stored_twice(user):
    make_notification(user, type=Notification.Type.CONTEST_STARTED, dedup_key="c_1")

    with pytest.raises(IntegrityError):
        make_notification(user, type=Notification.Type.CONTEST_STARTED, dedup_key="c_1")


@pytest.mark.django_db
def test_the_same_event_reaches_every_recipient(user, other):
    # The key is per-user: one event fanned out to two people is two rows, and
    # the constraint must not treat the second one as a duplicate.
    make_notification(user, type=Notification.Type.CONTEST_STARTED, dedup_key="c_1")
    make_notification(other, type=Notification.Type.CONTEST_STARTED, dedup_key="c_1")

    assert Notification.objects.count() == 2


@pytest.mark.django_db
def test_one_user_can_hold_different_events_and_types(user):
    # Same type, different event.
    make_notification(user, type=Notification.Type.CONTEST_STARTED, dedup_key="c_1")
    make_notification(user, type=Notification.Type.CONTEST_STARTED, dedup_key="c_2")
    # Same event, different type — a contest that started and then ended.
    make_notification(user, type=Notification.Type.CONTEST_ENDED, dedup_key="c_1")

    assert Notification.objects.count() == 3


# --- fields ----------------------------------------------------------------


@pytest.mark.django_db
def test_a_new_notification_starts_unseen_and_unlinked(user):
    notification = Notification.objects.create(
        user=user,
        type=Notification.Type.NEW_PROBLEM,
        dedup_key="problem_1_new",
        title="New problem",
        body="Two Sum is now available",
    )

    assert notification.seen_at is None  # this is what the counter counts
    assert notification.link == ""  # not clickable until a source sets one
    assert notification.created_at is not None


@pytest.mark.django_db
def test_deleting_the_user_takes_their_notifications(db):
    owner = make_user("owner", 1200)
    make_notification(owner)

    owner.delete()

    assert Notification.objects.count() == 0


# --- ordering / display ----------------------------------------------------


@pytest.mark.django_db
def test_the_feed_comes_back_newest_first(user):
    now = timezone.now()
    older = make_notification(user, dedup_key="a", created_at=now - timedelta(days=1))
    newer = make_notification(user, dedup_key="b", created_at=now)

    assert list(Notification.objects.all()) == [newer, older]


@pytest.mark.django_db
def test_str_names_the_recipient_and_the_headline(user):
    notification = make_notification(user, title="Rating changed")

    assert str(notification) == f"{user}: Rating changed"
