"""Tests for the one-time WebSocket ticket flow (contract: ws-ticket-auth).

Covers the mint endpoint and the middleware redemption rules:
valid ticket -> connect ok; reuse / expired / missing / garbage -> 4001.
"""

import pytest
from apps.realtime.middleware import TicketAuthMiddleware
from apps.realtime.routing import websocket_urlpatterns
from apps.realtime.tickets import issue_ticket
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

# The application under test: ticket middleware in front of the WS router,
# exactly as wired in config/asgi.py (minus the origin validator).
ws_app = TicketAuthMiddleware(URLRouter(websocket_urlpatterns))


def _connect(submission_id, ticket=None):
    path = f"/ws/submissions/{submission_id}/"
    if ticket is not None:
        path += f"?ticket={ticket}"
    return WebsocketCommunicator(ws_app, path)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


# user and submission come from conftest.


# --- endpoint --------------------------------------------------------------


@pytest.mark.django_db
def test_endpoint_mints_ticket_for_authenticated_user(user):
    client = APIClient()
    client.force_authenticate(user=user)
    resp = client.post(reverse("ws-ticket"))
    assert resp.status_code == 200
    assert resp.data["expires_in"] == 30
    assert isinstance(resp.data["ticket"], str) and len(resp.data["ticket"]) >= 32


@pytest.mark.django_db
def test_endpoint_requires_authentication():
    resp = APIClient().post(reverse("ws-ticket"))
    assert resp.status_code == 401


# --- middleware redemption -------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_valid_ticket_connects(user, submission):
    ticket = await _issue(user.id)
    communicator = _connect(submission.pk, ticket)
    connected, _ = await communicator.connect()
    assert connected
    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_reused_ticket_is_rejected(user, submission):
    ticket = await _issue(user.id)
    first = _connect(submission.pk, ticket)
    connected, _ = await first.connect()
    assert connected  # first use consumes the ticket
    await first.disconnect()

    second = _connect(submission.pk, ticket)  # same ticket again
    connected, code = await second.connect()
    assert not connected
    assert code == 4001


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_expired_ticket_is_rejected(user, submission):
    ticket = await _issue(user.id)
    await _evict(ticket)  # simulate TTL expiry: key no longer in cache
    connected, code = await _connect(submission.pk, ticket).connect()
    assert not connected
    assert code == 4001


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_missing_ticket_is_rejected(submission):
    connected, code = await _connect(submission.pk, ticket=None).connect()
    assert not connected
    assert code == 4001


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_garbage_ticket_is_rejected(submission):
    communicator = _connect(submission.pk, ticket="not-a-real-ticket")
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4001


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ticket_for_missing_user_is_rejected(submission):
    # Ticket is valid in the cache but points at a user that no longer exists
    # (e.g. deleted between minting and connecting) -> AnonymousUser -> 4001.
    ticket = await _issue(999_999_999)
    connected, code = await _connect(submission.pk, ticket).connect()
    assert not connected
    assert code == 4001


# --- helpers (cache ops must be called off the async loop) -----------------


async def _issue(user_id):
    from asgiref.sync import sync_to_async

    return await sync_to_async(issue_ticket)(user_id)


async def _evict(ticket):
    from asgiref.sync import sync_to_async

    await sync_to_async(cache.delete)(f"ws:ticket:{ticket}")
