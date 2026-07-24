import pytest
from apps.realtime.routing import websocket_urlpatterns
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from factories import make_contest

# user comes from conftest.


def make_app():
    return URLRouter(websocket_urlpatterns)


def make_communicator(user, contest_id):
    app = make_app()
    communicator = WebsocketCommunicator(app, f"/ws/contests/{contest_id}/")
    communicator.scope["user"] = user
    return communicator


async def add_participant(contest, user) -> None:
    await database_sync_to_async(contest.participants.add)(user)


@pytest.fixture
def active_contest(db):
    return make_contest("Test Contest")


@pytest.fixture
def finished_contest(db):
    return make_contest("Finished Contest", starts_in=-3, ends_in=-1)


async def _assert_rejected_with_code(communicator, expected_code: int) -> None:
    """
    The consumer calls accept() before close(code=...) so the client receives the
    custom close code as a proper WebSocket close frame.  That means connect()
    returns (True, None) — the handshake succeeded — and the close message
    arrives as the next output frame.
    """
    connected, _ = await communicator.connect()
    assert connected  # accept() was called first
    close_msg = await communicator.receive_output(timeout=1)
    assert close_msg["type"] == "websocket.close"
    assert close_msg.get("code") == expected_code


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unauthenticated_user_is_rejected(active_contest):
    from django.contrib.auth.models import AnonymousUser

    app = make_app()
    communicator = WebsocketCommunicator(app, f"/ws/contests/{active_contest.pk}/")
    communicator.scope["user"] = AnonymousUser()
    await _assert_rejected_with_code(communicator, 4001)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_nonexistent_contest_is_rejected(user):
    communicator = make_communicator(user, contest_id=99999)
    await _assert_rejected_with_code(communicator, 4004)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_non_participant_is_rejected(user, active_contest):
    communicator = make_communicator(user, active_contest.pk)
    await _assert_rejected_with_code(communicator, 4003)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_sends_nothing(user, active_contest):
    """The socket signals; it no longer pushes a snapshot on connect."""
    await add_participant(active_contest, user)
    communicator = make_communicator(user, active_contest.pk)
    try:
        connected, _ = await communicator.connect()
        assert connected
        assert await communicator.receive_nothing(timeout=0.3)
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_leaderboard_update_forwarded_without_payload(user, active_contest):
    """The event type is the whole message — no rows ride over the socket."""
    await add_participant(active_contest, user)
    communicator = make_communicator(user, active_contest.pk)
    try:
        await communicator.connect()

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"contest_{active_contest.pk}",
            {"type": "leaderboard_update"},
        )

        response = await communicator.receive_json_from()
        assert response == {"type": "leaderboard_update"}
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_contest_ended_closes_connection(user, active_contest):
    await add_participant(active_contest, user)
    communicator = make_communicator(user, active_contest.pk)
    try:
        await communicator.connect()

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"contest_{active_contest.pk}",
            {"type": "contest_ended"},
        )

        response = await communicator.receive_json_from()
        assert response == {"type": "contest_ended"}
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_to_rated_contest_sends_ended(user, finished_contest):
    """A contest that is over AND rated closes the socket right away — no
    snapshot, straight to the ended signal."""
    await add_participant(finished_contest, user)
    finished_contest.rating_applied = True
    await database_sync_to_async(finished_contest.save)(
        update_fields=["rating_applied"]
    )
    communicator = make_communicator(user, finished_contest.pk)
    try:
        connected, _ = await communicator.connect()
        assert connected

        ended_msg = await communicator.receive_json_from()
        assert ended_msg == {"type": "contest_ended"}
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_to_unrated_finished_contest_stays_open(user, finished_contest):
    """Time is up but ELO isn't applied yet — keep waiting for the event."""
    await add_participant(finished_contest, user)
    communicator = make_communicator(user, finished_contest.pk)
    try:
        connected, _ = await communicator.connect()
        assert connected
        assert await communicator.receive_nothing(timeout=0.3)
    finally:
        await communicator.disconnect()
