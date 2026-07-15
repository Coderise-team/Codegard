import uuid

import pytest
from apps.problems.models import Problem
from apps.realtime.routing import websocket_urlpatterns
from apps.submissions.models import Submission
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator


def make_communicator(user, submission_id):
    app = URLRouter(websocket_urlpatterns)
    communicator = WebsocketCommunicator(app, f"/ws/submissions/{submission_id}/")
    communicator.scope["user"] = user
    return communicator


async def _assert_rejected_with_code(communicator, expected_code: int) -> None:
    connected, close_code = await communicator.connect()
    assert not connected
    assert close_code == expected_code


@pytest.fixture
def user(db, django_user_model):
    uid = uuid.uuid4().hex[:6]
    return django_user_model.objects.create_user(
        username=f"owner_{uid}", password="pass", email=f"owner_{uid}@example.com"
    )


@pytest.fixture
def other_user(db, django_user_model):
    uid = uuid.uuid4().hex[:6]
    return django_user_model.objects.create_user(
        username=f"other_{uid}", password="pass", email=f"other_{uid}@example.com"
    )


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def submission(db, user, problem):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x=1",
        language=Submission.Language.PYTHON,
    )


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unauthenticated_user_is_rejected(submission):
    from django.contrib.auth.models import AnonymousUser

    app = URLRouter(websocket_urlpatterns)
    communicator = WebsocketCommunicator(app, f"/ws/submissions/{submission.pk}/")
    communicator.scope["user"] = AnonymousUser()
    await _assert_rejected_with_code(communicator, 4001)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_nonexistent_submission_is_rejected(user):
    communicator = make_communicator(user, submission_id=99999)
    await _assert_rejected_with_code(communicator, 4004)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_wrong_owner_is_rejected(other_user, submission):
    communicator = make_communicator(other_user, submission.pk)
    await _assert_rejected_with_code(communicator, 4003)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_sends_initial_status(user, submission):
    communicator = make_communicator(user, submission.pk)
    try:
        connected, _ = await communicator.connect()
        assert connected

        msg = await communicator.receive_json_from()
        assert msg["type"] == "submission_update"
        assert msg["submission_id"] == submission.pk
        assert msg["verdict"] is None  # still pending
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_submission_update_forwarded(user, submission):
    communicator = make_communicator(user, submission.pk)
    try:
        await communicator.connect()
        await communicator.receive_json_from()  # consume initial

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"submission_{submission.pk}",
            {
                "type": "submission_update",
                "submission_id": submission.pk,
                "verdict": Submission.Verdict.AC,
            },
        )

        msg = await communicator.receive_json_from()
        assert msg["type"] == "submission_update"
        assert msg["verdict"] == Submission.Verdict.AC
    finally:
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_reconnect_gets_current_verdict(user, submission):
    """On reconnect the client immediately receives the current verdict."""
    await database_sync_to_async(Submission.objects.filter(pk=submission.pk).update)(
        verdict=Submission.Verdict.WA
    )

    communicator = make_communicator(user, submission.pk)
    try:
        connected, _ = await communicator.connect()
        assert connected

        msg = await communicator.receive_json_from()
        assert msg["type"] == "submission_update"
        assert msg["verdict"] == Submission.Verdict.WA
    finally:
        await communicator.disconnect()
