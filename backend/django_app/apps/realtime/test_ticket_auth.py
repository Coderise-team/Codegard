"""Tests for the one-time WebSocket ticket flow (contract: ws-ticket-auth).

Covers the mint endpoint and the middleware redemption rules:
valid ticket -> connect ok; reuse / expired / missing / garbage -> 4001.
"""

import uuid

import pytest
from apps.problems.models import Problem
from apps.realtime.middleware import TicketAuthMiddleware
from apps.realtime.routing import websocket_urlpatterns
from apps.realtime.tickets import issue_ticket
from apps.submissions.models import Submission
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


@pytest.fixture
def user(db, django_user_model):
    uid = uuid.uuid4().hex[:6]
    return django_user_model.objects.create_user(
        username=f"u_{uid}", password="pass", email=f"u_{uid}@example.com"
    )


@pytest.fixture
def submission(db, user):
    problem = Problem.objects.create(
        title="Two Sum",
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x=1",
        language=Submission.Language.PYTHON,
    )


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


async def _assert_rejected_with_code(communicator, expected_code: int = 4001) -> None:
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
async def test_reused_ticket_is_rejected(user, submission):
    ticket = await _issue(user.id)
    first = _connect(submission.pk, ticket)
    connected, _ = await first.connect()
    assert connected  # first use consumes the ticket
    await first.disconnect()

    second = _connect(submission.pk, ticket)  # same ticket again
    await _assert_rejected_with_code(second)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_expired_ticket_is_rejected(user, submission):
    ticket = await _issue(user.id)
    await _evict(ticket)  # simulate TTL expiry: key no longer in cache
    await _assert_rejected_with_code(_connect(submission.pk, ticket))


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_missing_ticket_is_rejected(submission):
    await _assert_rejected_with_code(_connect(submission.pk, ticket=None))


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_garbage_ticket_is_rejected(submission):
    await _assert_rejected_with_code(_connect(submission.pk, ticket="not-a-real"))


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_ticket_for_missing_user_is_rejected(submission):
    # Ticket is valid in the cache but points at a user that no longer exists
    # (e.g. deleted between minting and connecting) -> AnonymousUser -> 4001.
    ticket = await _issue(999_999_999)
    await _assert_rejected_with_code(_connect(submission.pk, ticket))


# --- helpers (cache ops must be called off the async loop) -----------------


async def _issue(user_id):
    from asgiref.sync import sync_to_async

    return await sync_to_async(issue_ticket)(user_id)


async def _evict(ticket):
    from asgiref.sync import sync_to_async

    await sync_to_async(cache.delete)(f"ws:ticket:{ticket}")
