"""One-time tokens for the links in account emails.

No table of our own: a token is Django's signed ``<timestamp>-<hash>``, and the
hash covers the user's state. Change that state and every token issued before
it stops matching, which is what makes a link single-use:

- password reset hashes the password (Django's default), so setting a new
  password kills the link that was used to set it;
- email verification hashes the address and ``email_verified``, so confirming
  the address kills the link that confirmed it.

Each kind gets its own ``key_salt``, so a token of one kind never passes as the
other, and its own lifetime.

The lifetime needs a workaround. Django has one limit for every generator,
``settings.PASSWORD_RESET_TIMEOUT``, read inside ``check_token`` itself. That
setting is therefore the LONGEST lifetime of the two, and each generator checks
its own, possibly shorter, one on top of Django's check — narrowing a limit
takes four lines, while widening it would mean copying Django's signature
check.
"""

from datetime import timedelta

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import (
    base36_to_int,
    urlsafe_base64_decode,
    urlsafe_base64_encode,
)

from .models import User

# Lifetimes, in seconds. Product decisions, so plain constants, not env config.
# settings.PASSWORD_RESET_TIMEOUT must stay >= the larger of the two.
EMAIL_VERIFICATION_TIMEOUT = int(timedelta(days=3).total_seconds())
PASSWORD_RESET_TIMEOUT = int(timedelta(hours=1).total_seconds())


class _ExpiringTokenGenerator(PasswordResetTokenGenerator):
    """Django's generator with a lifetime of its own (``timeout``, seconds)."""

    timeout: int

    def check_token(self, user, token):
        # Django splits the token as a string; anything else is just invalid.
        if not isinstance(token, str):
            return False
        # Django checks the signature and the one global limit; a token that
        # passes is well-formed, so its timestamp parses.
        if not super().check_token(user, token):
            return False
        timestamp = base36_to_int(token.split("-")[0])
        return self._num_seconds(self._now()) - timestamp <= self.timeout


class PasswordResetTokens(_ExpiringTokenGenerator):
    """Password reset links. Django's own hash: it covers the password, so the
    link dies once a new password is set — including the very first password
    of an OAuth user, whose unusable one changes all the same."""

    key_salt = "apps.users.tokens.PasswordResetTokens"
    timeout = PASSWORD_RESET_TIMEOUT


class EmailVerificationTokens(_ExpiringTokenGenerator):
    """Email verification links. The hash covers the address and the flag:
    confirming the address kills the link, and so would a change of address."""

    key_salt = "apps.users.tokens.EmailVerificationTokens"
    timeout = EMAIL_VERIFICATION_TIMEOUT

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.email_verified}{timestamp}"


password_reset_token = PasswordResetTokens()
email_verification_token = EmailVerificationTokens()


def encode_uid(user) -> str:
    """The ``uid`` half of a link: the user's pk, URL-safe base64."""
    return urlsafe_base64_encode(force_bytes(user.pk))


def user_from_uid(uid) -> User | None:
    """The active user a link's ``uid`` points at, or None.

    Anything wrong with it — not a string (a JSON body can send null or a
    number), not base64, not a number, nobody by that pk, a deactivated
    account — is the same None: a link that cannot be honoured. Deactivated is
    in that list on purpose, so a banned account cannot be taken back over
    through a reset link.
    """
    if not isinstance(uid, str):
        return None
    try:
        pk = int(urlsafe_base64_decode(uid).decode())
    except (TypeError, ValueError, UnicodeDecodeError):
        return None
    return User.objects.filter(pk=pk, is_active=True).first()
