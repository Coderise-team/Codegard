"""Tests for the three bell endpoints.

The theme throughout is that a notification belongs to exactly one person and
that nothing is ever dimmed by accident: /seen/ touches the ids it was handed
and no others, skips anything that arrived mid-request, and reports back the
number that is left.
"""

from datetime import timedelta

import pytest
from apps.notifications.models import Notification
from django.urls import reverse
from django.utils import timezone
from factories import make_notification

LIST_URL = reverse("notifications:notification-list")
COUNT_URL = reverse("notifications:notification-unread-count")
SEEN_URL = reverse("notifications:notification-seen")

# user, other, api_client and user_client come from the project conftest.

# --- the feed --------------------------------------------------------------


@pytest.mark.django_db
def test_the_feed_returns_only_your_own(user_client, user, other):
    mine = make_notification(user, dedup_key="mine")
    make_notification(other, dedup_key="theirs")

    response = user_client.get(LIST_URL)

    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [mine.id]


@pytest.mark.django_db
def test_the_feed_serves_the_agreed_shape(user_client, user):
    make_notification(
        user,
        type=Notification.Type.RATING_CHANGED,
        title="Rating changed",
        body="+37 -> 1461",
        link="/users/1",
    )

    row = user_client.get(LIST_URL).data["results"][0]

    assert set(row) == {
        "id",
        "type",
        "title",
        "body",
        "link",
        "seen_at",
        "created_at",
    }
    assert row["type"] == "rating_changed"
    assert row["body"] == "+37 -> 1461"
    assert row["seen_at"] is None


@pytest.mark.django_db
def test_the_feed_is_newest_first(user_client, user):
    now = timezone.now()
    older = make_notification(user, dedup_key="a", created_at=now - timedelta(days=1))
    newer = make_notification(user, dedup_key="b", created_at=now)

    results = user_client.get(LIST_URL).data["results"]

    assert [row["id"] for row in results] == [newer.id, older.id]


@pytest.mark.django_db
def test_the_client_can_ask_for_a_smaller_page(user_client, user):
    for i in range(3):
        make_notification(user, dedup_key=f"k{i}")

    response = user_client.get(LIST_URL, {"page_size": 2})

    assert response.data["count"] == 3
    assert len(response.data["results"]) == 2
    assert response.data["next"] is not None


@pytest.mark.django_db
def test_rows_sharing_a_timestamp_do_not_shuffle_between_pages(user_client, user):
    """A fan-out writes many rows in one instant; paging must stay stable.

    Without a constant tiebreaker a row can slide across the page boundary
    between two requests — and since the client dims by id, such a row would
    never be shown and never be dimmed.
    """
    stamp = timezone.now()
    for i in range(6):
        make_notification(user, dedup_key=f"k{i}", created_at=stamp)

    first = user_client.get(LIST_URL, {"page_size": 3}).data["results"]
    second = user_client.get(LIST_URL, {"page_size": 3, "page": 2}).data["results"]

    ids = [row["id"] for row in first] + [row["id"] for row in second]
    assert len(set(ids)) == 6  # every row shown exactly once


@pytest.mark.django_db
def test_the_feed_needs_a_login(api_client):
    assert api_client.get(LIST_URL).status_code == 401


# --- the counter -----------------------------------------------------------


@pytest.mark.django_db
def test_the_counter_counts_the_unseen(user_client, user):
    make_notification(user, dedup_key="a")
    make_notification(user, dedup_key="b")
    make_notification(user, dedup_key="c", seen_at=timezone.now())

    assert user_client.get(COUNT_URL).data == {"count": 2}


@pytest.mark.django_db
def test_the_counter_ignores_other_peoples_notifications(user_client, user, other):
    make_notification(other, dedup_key="theirs")

    assert user_client.get(COUNT_URL).data == {"count": 0}


@pytest.mark.django_db
def test_the_counter_needs_a_login(api_client):
    assert api_client.get(COUNT_URL).status_code == 401


# --- marking as seen -------------------------------------------------------


@pytest.mark.django_db
def test_seen_dims_exactly_what_was_passed(user_client, user):
    watched = make_notification(user, dedup_key="a")
    untouched = make_notification(user, dedup_key="b")

    response = user_client.post(SEEN_URL, {"ids": [watched.id]}, format="json")

    assert response.status_code == 200
    watched.refresh_from_db()
    untouched.refresh_from_db()
    assert watched.seen_at is not None
    assert untouched.seen_at is None  # never scrolled to, still unseen


@pytest.mark.django_db
def test_seen_answers_with_what_is_left(user_client, user):
    seen_now = make_notification(user, dedup_key="a")
    make_notification(user, dedup_key="b")
    make_notification(user, dedup_key="c")

    response = user_client.post(SEEN_URL, {"ids": [seen_now.id]}, format="json")

    # Not zero after a look at the feed - the remainder is the "keep scrolling" cue.
    assert response.data == {"count": 2}


@pytest.mark.django_db
def test_seen_does_not_swallow_what_arrived_mid_request(user_client, user):
    """The race guard: a row created after the request started stays unseen."""
    just_landed = make_notification(
        user, dedup_key="a", created_at=timezone.now() + timedelta(minutes=1)
    )

    response = user_client.post(SEEN_URL, {"ids": [just_landed.id]}, format="json")

    just_landed.refresh_from_db()
    assert just_landed.seen_at is None
    assert response.data == {"count": 1}


@pytest.mark.django_db
def test_seen_ignores_ids_that_are_not_yours(user_client, user, other):
    theirs = make_notification(other, dedup_key="theirs")

    response = user_client.post(SEEN_URL, {"ids": [theirs.id]}, format="json")

    theirs.refresh_from_db()
    assert theirs.seen_at is None
    assert response.data == {"count": 0}


@pytest.mark.django_db
def test_seen_leaves_an_already_seen_row_alone(user_client, user):
    """Re-sending an id must not move the timestamp of a row seen days ago."""
    first_look = timezone.now() - timedelta(days=2)
    already = make_notification(user, dedup_key="a", seen_at=first_look)

    user_client.post(SEEN_URL, {"ids": [already.id]}, format="json")

    already.refresh_from_db()
    assert already.seen_at == first_look


@pytest.mark.django_db
def test_seen_accepts_an_empty_list(user_client, user):
    make_notification(user, dedup_key="a")

    response = user_client.post(SEEN_URL, {"ids": []}, format="json")

    assert response.status_code == 200
    assert response.data == {"count": 1}


@pytest.mark.django_db
def test_seen_rejects_a_body_without_ids(user_client, user):
    assert user_client.post(SEEN_URL, {}, format="json").status_code == 400


@pytest.mark.django_db
def test_seen_rejects_ids_that_are_not_numbers(user_client, user):
    response = user_client.post(SEEN_URL, {"ids": ["abc"]}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_seen_needs_a_login(api_client):
    assert api_client.post(SEEN_URL, {"ids": []}, format="json").status_code == 401
