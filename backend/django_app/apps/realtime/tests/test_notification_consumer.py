"""Tests for the notification doorbell socket.

The socket carries no data, so what is worth pinning down is who it reaches:
the connected user and nobody else, every tab that user has open, and never an
anonymous visitor.
"""

import pytest
from apps.realtime.routing import websocket_urlpatterns
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

# user comes from conftest.


def make_communicator(user):
    communicator = WebsocketCommunicator(
        URLRouter(websocket_urlpatterns), "/ws/notifications/"
    )
    communicator.scope["user"] = user
    return communicator


async def ring(user_id):
    await get_channel_layer().group_send(f"user_{user_id}", {"type": "notification"})


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_anonymous_visitor_is_rejected():
    from django.contrib.auth.models import AnonymousUser

    communicator = make_communicator(AnonymousUser())

    connected, _ = await communicator.connect()
    assert connected  # accept() ran first, so the close code can reach the client
    close_msg = await communicator.receive_output(timeout=1)
    assert close_msg["type"] == "websocket.close"
    assert close_msg.get("code") == 4001


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_sends_nothing(user):
    """The page fetches its count over HTTP on load; the socket stays quiet."""
    communicator = make_communicator(user)
    try:
        connected, _ = await communicator.connect()
        assert connected
        assert await communicator.receive_nothing(timeout=0.3)
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_the_doorbell_arrives_without_a_payload(user):
    communicator = make_communicator(user)
    try:
        await communicator.connect()

        await ring(user.pk)

        assert await communicator.receive_json_from() == {"type": "notification"}
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_the_socket_stays_open_after_a_ring(user):
    """Unlike contest_ended, this event is not terminal — more will follow."""
    communicator = make_communicator(user)
    try:
        await communicator.connect()

        await ring(user.pk)
        await communicator.receive_json_from()
        await ring(user.pk)

        assert await communicator.receive_json_from() == {"type": "notification"}
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_someone_elses_doorbell_never_reaches_you(user, other):
    communicator = make_communicator(user)
    try:
        await communicator.connect()

        await ring(other.pk)

        assert await communicator.receive_nothing(timeout=0.3)
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_every_tab_of_the_same_person_is_rung(user):
    """One ring per person, and each open tab hears it."""
    first = make_communicator(user)
    second = make_communicator(user)
    try:
        await first.connect()
        await second.connect()

        await ring(user.pk)

        assert await first.receive_json_from() == {"type": "notification"}
        assert await second.receive_json_from() == {"type": "notification"}
    finally:
        await first.disconnect()
        await second.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_a_closed_tab_stops_listening(user):
    """disconnect() leaves the group, so a ring is not held for a dead socket."""
    communicator = make_communicator(user)
    await communicator.connect()
    await communicator.disconnect()

    await ring(user.pk)

    reconnected = make_communicator(user)
    try:
        await reconnected.connect()
        # The earlier ring was delivered to nobody, not queued for the next visit.
        assert await reconnected.receive_nothing(timeout=0.3)
    finally:
        await reconnected.disconnect()
