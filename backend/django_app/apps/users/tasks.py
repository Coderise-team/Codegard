import logging
from functools import partial

from celery import shared_task
from django.core.mail import send_mail
from django.core.management import call_command
from django.db import transaction

from .emails import password_reset_message, verification_message
from .models import User

logger = logging.getLogger(__name__)

# Account emails go out over SMTP, which is slow and fails now and then; the
# request that asked for the email must not wait for it or fail with it. A
# failure is retried with a growing, jittered delay: 1st retry within ~1 min,
# later ones up to 10 min apart, five in all — enough to ride out a relay
# outage without retrying a dead address forever. smtplib's errors and
# socket timeouts are both OSError.
_RETRY = {
    "autoretry_for": (OSError,),
    "retry_backoff": 60,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 5,
}


@shared_task
def flush_expired_jwt_tokens():
    """Run SimpleJWT's cleanup command for expired blacklist tokens."""

    call_command("flushexpiredtokens")


@shared_task(bind=True, **_RETRY)
def send_verification_email(self, user_id: int) -> bool:
    """Email ``user_id`` a link that confirms their address.

    Takes the id, not a token: the token is made here, at sending time, so no
    secret ever sits in the broker. Returns whether an email went out — nothing
    is sent to an account that is gone, deactivated, or verified by the time
    the task runs (the link would be dead on arrival).
    """
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None or user.email_verified:
        return False
    subject, body = verification_message(user)
    send_mail(subject, body, None, [user.email])
    logger.info("Sent the verification email to user #%s", user_id)
    return True


@shared_task(bind=True, **_RETRY)
def send_password_reset_email(self, user_id: int) -> bool:
    """Email ``user_id`` a link that sets a new password.

    Any active account gets it, a passwordless OAuth one included — that is how
    such a user sets their first password. Returns whether an email went out.
    """
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return False
    subject, body = password_reset_message(user)
    send_mail(subject, body, None, [user.email])
    logger.info("Sent the password reset email to user #%s", user_id)
    return True


def queue_verification_email(user) -> None:
    """Send the verification email once the current transaction commits.

    After the commit, not before: a worker picking the task up first would not
    find the user that is still being created. Outside a transaction the task
    is queued at once.
    """
    transaction.on_commit(partial(send_verification_email.delay, user.pk))


def queue_password_reset_email(user) -> None:
    """Send the password reset email once the current transaction commits."""
    transaction.on_commit(partial(send_password_reset_email.delay, user.pk))
