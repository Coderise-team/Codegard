"""The text of the account emails and the links inside them.

Plain text, English like the rest of the interface, and short: what the email
is, the link, how long it works, and "ignore it if it wasn't you". Building a
message is kept apart from sending it (apps.users.tasks), so the wording can be
read and tested without a mail server.

The links point at the frontend, which owns the two pages and posts the uid and
token back to the API.
"""

from urllib.parse import urlencode

from django.conf import settings

from .tokens import (
    EMAIL_VERIFICATION_TIMEOUT,
    PASSWORD_RESET_TIMEOUT,
    email_verification_token,
    encode_uid,
    password_reset_token,
)

VERIFY_EMAIL_PATH = "/verify-email"
RESET_PASSWORD_PATH = "/reset-password"


def _link(path: str, user, token: str) -> str:
    query = urlencode({"uid": encode_uid(user), "token": token})
    return f"{settings.SITE_URL}{path}?{query}"


def _lifetime(seconds: int) -> str:
    """'3 days', '1 hour' — the lifetimes are whole days or whole hours."""
    hours = seconds // 3600
    if hours % 24 == 0:
        days = hours // 24
        return f"{days} day{'s' if days != 1 else ''}"
    return f"{hours} hour{'s' if hours != 1 else ''}"


def verification_message(user) -> tuple[str, str]:
    """(subject, body) of the email that confirms ``user``'s address."""
    link = _link(VERIFY_EMAIL_PATH, user, email_verification_token.make_token(user))
    body = (
        f"Hi {user.username},\n"
        "\n"
        f"Please confirm that {user.email} is your email address by opening "
        "this link:\n"
        "\n"
        f"{link}\n"
        "\n"
        f"The link works for {_lifetime(EMAIL_VERIFICATION_TIMEOUT)}.\n"
        "\n"
        "If you didn't create a Codegard account, just ignore this email.\n"
        "\n"
        "Codegard\n"
    )
    return "Confirm your email for Codegard", body


def password_reset_message(user) -> tuple[str, str]:
    """(subject, body) of the email that lets ``user`` set a new password.

    Someone who has only ever signed in with Google or GitHub has no password
    to reset, so for them the same link is worded as setting one.
    """
    link = _link(RESET_PASSWORD_PATH, user, password_reset_token.make_token(user))
    if user.has_usable_password():
        intro = (
            "We received a request to reset the password for your Codegard "
            "account. Open this link to choose a new one:"
        )
        if_not_you = (
            "If you didn't ask for this, just ignore this email. Your password "
            "stays the same."
        )
    else:
        intro = (
            "We received a request to set a password for your Codegard account. "
            "Open this link to choose one; signing in with Google or GitHub "
            "keeps working as well:"
        )
        if_not_you = "If you didn't ask for this, just ignore this email."
    body = (
        f"Hi {user.username},\n"
        "\n"
        f"{intro}\n"
        "\n"
        f"{link}\n"
        "\n"
        f"The link works for {_lifetime(PASSWORD_RESET_TIMEOUT)} and only once.\n"
        "\n"
        f"{if_not_you}\n"
        "\n"
        "Codegard\n"
    )
    return "Reset your Codegard password", body
