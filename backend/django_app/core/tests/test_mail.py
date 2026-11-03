"""Tests for the dev email backend that keeps links copyable."""

import io

from django.core.mail import EmailMessage

from core.mail import ReadableConsoleBackend

LONG_LINK = (
    "http://localhost:5173/verify-email?uid=NDI&token=dha5ma-"
    "428f09e83d13baadc5b6fc9a8bf73483"
)


def test_a_long_link_is_printed_whole_and_unencoded():
    stream = io.StringIO()
    message = EmailMessage(
        subject="Confirm your email for Codegard",
        body=f"Open this link:\n\n{LONG_LINK}\n",
        from_email="Codegard <no-reply@codegard.dev>",
        to=["demo@example.com"],
    )

    ReadableConsoleBackend(stream=stream).send_messages([message])

    printed = stream.getvalue()
    assert LONG_LINK in printed.splitlines()
    assert "=3D" not in printed
    assert "Subject: Confirm your email for Codegard" in printed
    assert "From: Codegard <no-reply@codegard.dev>" in printed
    assert "To: demo@example.com" in printed
