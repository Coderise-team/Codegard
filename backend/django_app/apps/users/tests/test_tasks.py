"""Tests for the users Celery tasks."""

from unittest import mock

from apps.users.tasks import flush_expired_jwt_tokens


def test_flush_expired_jwt_tokens_delegates_to_management_command():
    """The task is a thin wrapper around SimpleJWT's flushexpiredtokens command."""
    with mock.patch("apps.users.tasks.call_command") as call_command:
        flush_expired_jwt_tokens()
    call_command.assert_called_once_with("flushexpiredtokens")
