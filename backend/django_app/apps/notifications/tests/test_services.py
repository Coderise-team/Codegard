"""Tests for the creation service: the dedup on both paths, and — the part that
matters most — that ``create_bulk`` reports only the people it actually reached.

That return value is what the doorbell is rung by. If it were the audience
instead of the newcomers, a task like ``notify_contests_starting_soon`` (every
minute, 15-minute window) would ring a thousand people fourteen times over for
rows it never wrote, so the "second run rings nobody" case below is the real
subject of this file.
"""

from unittest.mock import patch

import pytest
from apps.notifications.models import Notification
from apps.notifications.services import (
    create_bulk,
    create_notification,
    notify_user,
    notify_users,
)
from factories import make_notification, make_user

# --- create_notification ---------------------------------------------------


@pytest.mark.django_db
def test_create_notification_writes_the_row_and_reports_it_as_new(user):
    notification, created = create_notification(
        user=user,
        type=Notification.Type.RATING_CHANGED,
        dedup_key="contest_1_rating",
        title="Rating changed",
        body="+37 -> 1461",
        link="/users/1",
    )

    assert created is True
    assert notification.title == "Rating changed"
    assert notification.body == "+37 -> 1461"
    assert notification.link == "/users/1"
    assert notification.seen_at is None


@pytest.mark.django_db
def test_create_notification_is_silent_on_a_repeat(user):
    first, _ = create_notification(
        user=user,
        type=Notification.Type.RATING_CHANGED,
        dedup_key="contest_1_rating",
        title="Rating changed",
        body="+37 -> 1461",
    )

    second, created = create_notification(
        user=user,
        type=Notification.Type.RATING_CHANGED,
        dedup_key="contest_1_rating",
        title="Rating changed",
        body="+37 -> 1461",
    )

    assert created is False  # the caller must not ring on this
    assert second.pk == first.pk
    assert Notification.objects.count() == 1


@pytest.mark.django_db
def test_a_repeat_never_rewrites_what_the_user_already_saw(user):
    create_notification(
        user=user,
        type=Notification.Type.CONTEST_STARTED,
        dedup_key="contest_1_started_100",
        title="Contest started",
        body="Round 1 has started",
    )

    # Same event offered again with different text: the stored row wins.
    notification, created = create_notification(
        user=user,
        type=Notification.Type.CONTEST_STARTED,
        dedup_key="contest_1_started_100",
        title="Rewritten",
        body="Rewritten",
    )

    assert created is False
    assert notification.title == "Contest started"


# --- create_bulk -----------------------------------------------------------


@pytest.mark.django_db
def test_create_bulk_writes_a_row_for_everyone_and_returns_them(db):
    a = make_user("a", 1200)
    b = make_user("b", 1200)

    recipients = create_bulk(
        [a.id, b.id],
        type=Notification.Type.CONTEST_STARTING_SOON,
        dedup_key="contest_1_soon_100",
        title="Contest starting soon",
        body="Round 1 starts in ~15 min",
        link="/contests/1",
    )

    assert recipients == {a.id, b.id}
    assert Notification.objects.count() == 2
    assert set(Notification.objects.values_list("user_id", flat=True)) == {a.id, b.id}


@pytest.mark.django_db
def test_create_bulk_rings_nobody_on_a_second_run(db):
    """The 14 idle runs of a 15-minute window must be completely silent."""
    a = make_user("a", 1200)
    b = make_user("b", 1200)
    kwargs = dict(
        type=Notification.Type.CONTEST_STARTING_SOON,
        dedup_key="contest_1_soon_100",
        title="Contest starting soon",
        body="Round 1 starts in ~15 min",
    )
    create_bulk([a.id, b.id], **kwargs)

    recipients = create_bulk([a.id, b.id], **kwargs)

    assert recipients == set()  # nothing to ring
    assert Notification.objects.count() == 2  # and nothing written


@pytest.mark.django_db
def test_create_bulk_returns_only_the_newcomers(db):
    """A user who joined between two runs gets the row; the rest stay quiet."""
    a = make_user("a", 1200)
    b = make_user("b", 1200)
    kwargs = dict(
        type=Notification.Type.CONTEST_STARTING_SOON,
        dedup_key="contest_1_soon_100",
        title="Contest starting soon",
        body="Round 1 starts in ~15 min",
    )
    create_bulk([a.id], **kwargs)

    recipients = create_bulk([a.id, b.id], **kwargs)

    assert recipients == {b.id}
    assert Notification.objects.filter(user=b).count() == 1
    assert Notification.objects.filter(user=a).count() == 1


@pytest.mark.django_db
def test_create_bulk_skips_the_insert_entirely_when_nothing_is_new(
    db, django_assert_num_queries
):
    a = make_user("a", 1200)
    kwargs = dict(
        type=Notification.Type.CONTEST_STARTING_SOON,
        dedup_key="contest_1_soon_100",
        title="Contest starting soon",
        body="Round 1 starts in ~15 min",
    )
    create_bulk([a.id], **kwargs)

    # One SELECT to find out, and no INSERT behind it.
    with django_assert_num_queries(1):
        create_bulk([a.id], **kwargs)


@pytest.mark.django_db
def test_create_bulk_reaches_a_crowd_in_two_queries(db, django_assert_num_queries):
    ids = [make_user(f"u{i}", 1200).id for i in range(5)]

    # The lookup, then one insert for all five — not one insert per person.
    with django_assert_num_queries(2):
        create_bulk(
            ids,
            type=Notification.Type.NEW_PROBLEM,
            dedup_key="problem_1_new",
            title="New problem",
            body="Two Sum is now available",
        )


@pytest.mark.django_db
def test_create_bulk_on_an_empty_audience_does_nothing(db, django_assert_num_queries):
    """A contest with no participants must not cost a query, let alone raise."""
    with django_assert_num_queries(0):
        recipients = create_bulk(
            [],
            type=Notification.Type.CONTEST_STARTED,
            dedup_key="contest_1_started_100",
            title="Contest started",
            body="Round 1 has started",
        )

    assert recipients == set()


@pytest.mark.django_db
def test_create_bulk_looks_only_at_its_own_event(db):
    """A row for a different event must not make someone look already-notified."""
    a = make_user("a", 1200)
    make_notification(
        a, type=Notification.Type.CONTEST_STARTED, dedup_key="contest_1_started_100"
    )

    recipients = create_bulk(
        [a.id],
        type=Notification.Type.CONTEST_ENDED,
        dedup_key="contest_1_ended_200",
        title="Contest finished",
        body="Round 1 has ended - results are in",
    )

    assert recipients == {a.id}
    assert Notification.objects.filter(user=a).count() == 2


# --- notify_user -----------------------------------------------------------


@pytest.mark.django_db
def test_notify_user_rings_that_users_group_with_an_empty_signal(user):
    with patch("apps.notifications.services.group_send") as send:
        notify_user(user.id)

    send.assert_called_once_with(f"user_{user.id}", {"type": "notification"})


def test_notify_user_survives_an_unconfigured_channel_layer():
    """Plain unit tests run without a channel layer; ringing must be a no-op."""
    with patch("channels.layers.get_channel_layer", return_value=None):
        notify_user(1)  # should not raise


# --- notify_users ----------------------------------------------------------


def test_notify_users_rings_everyone_it_is_given():
    with patch("apps.notifications.services.group_send") as send:
        notify_users([1, 2, 3])

    assert [c.args[0] for c in send.call_args_list] == ["user_1", "user_2", "user_3"]


def test_notify_users_stops_at_the_first_failure(caplog):
    """The next sends would hit the same unreachable Redis and wait just as
    long, so the run ends there. The failure is logged, not raised."""
    with patch(
        "apps.notifications.services.group_send",
        side_effect=[None, ConnectionError("redis down"), None],
    ) as send:
        notify_users([1, 2, 3])  # must not raise

    assert send.call_count == 2  # user 3 is never tried
    assert "skipping the remaining rings" in caplog.text


def test_notify_users_with_nobody_to_ring_does_nothing():
    with patch("apps.notifications.services.group_send") as send:
        notify_users([])

    send.assert_not_called()
