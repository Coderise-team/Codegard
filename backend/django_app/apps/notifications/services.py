"""The one place a notification is born, and the one place the bell is rung.

Two creation paths, one guarantee. ``create_notification`` writes a single row
for a single person; ``create_bulk`` fans one event out to a crowd. Both lean on
the same ``(user, type, dedup_key)`` uniqueness: sources are periodic tasks and
signals, they will offer the same event more than once on purpose, and it is the
key — not the caller's bookkeeping — that makes delivery exactly-once.

Neither function rings the doorbell. That is deliberate: one admin action can
create thousands of rows, and a person needs exactly one signal per run no
matter how many rows landed. So creation only writes, and the caller collects
the recipients it actually reached, then rings each of them once from
``transaction.on_commit`` — see ``notify_users``.
"""

import logging

from apps.realtime.broadcast import group_send
from apps.realtime.events import NotificationEvents

from .models import Notification

logger = logging.getLogger(__name__)


def create_notification(*, user, type, dedup_key, title, body, link=""):
    """Create one notification, or quietly do nothing if it already exists.

    Returns ``(notification, created)``. ``created`` is what the caller rings
    on: a duplicate means the person was already told, and telling them again
    would be noise.
    """
    return Notification.objects.get_or_create(
        user=user,
        type=type,
        dedup_key=dedup_key,
        defaults={"title": title, "body": body, "link": link},
    )


def create_bulk(user_ids, *, type, dedup_key, title, body, link=""):
    """Fan one event out to many people. Returns the ids that actually got a row.

    Takes ids rather than model instances: the audience here is "every active
    user", and pulling a thousand full User objects to read a thousand primary
    keys is work nobody needs. Callers pass
    ``.values_list("id", flat=True)``.

    The existing recipients are subtracted *before* the insert, and that is the
    point of this function. ``bulk_create(ignore_conflicts=True)`` will not tell
    us which rows it actually wrote — on PostgreSQL it does not even populate
    the primary keys — so without this SELECT the caller has no honest answer to
    "who is new" and would have to ring everyone it aimed at. That is not
    hypothetical: ``notify_contests_starting_soon`` runs every minute against a
    15-minute window, so one contest is picked up on ~15 consecutive runs. The
    first run creates the rows and the next fourteen create nothing — ringing by
    audience would mean fourteen thousand pointless doorbells for a thousand
    users, each one pulling an unread-count request out of every open tab. As a
    bonus the INSERT itself shrinks to nothing on those later runs instead of
    offering a thousand rows to be ignored.

    ``ignore_conflicts`` stays on regardless: it is no longer the working
    mechanism, it is the backstop for the race where two workers both read
    "these people don't have it yet" and both go to insert.
    """
    user_ids = set(user_ids)
    if not user_ids:
        return set()

    already_notified = set(
        Notification.objects.filter(
            type=type, dedup_key=dedup_key, user_id__in=user_ids
        ).values_list("user_id", flat=True)
    )
    recipients = user_ids - already_notified
    if not recipients:
        return set()

    Notification.objects.bulk_create(
        [
            Notification(
                user_id=user_id,
                type=type,
                dedup_key=dedup_key,
                title=title,
                body=body,
                link=link,
            )
            for user_id in recipients
        ],
        ignore_conflicts=True,
    )
    return recipients


def notify_user(user_id) -> None:
    """Ring one person's bell — a payload-free "you have something new".

    Raises when the channel layer cannot be reached; ``notify_users`` is what
    callers use, and it is where a failure is contained.
    """
    group_send(f"user_{user_id}", {"type": NotificationEvents.NOTIFICATION})


def notify_users(user_ids) -> None:
    """Ring each of these people once, and give up at the first failure.

    Call this from ``transaction.on_commit``: the signal must never arrive
    before the rows it announces are durable, or the client refetches and finds
    nothing. Pass everyone the run reached, collected across the whole run, so
    each person is rung once however many rows they got — the signal carries no
    data, so eight rings and one cost the client the same single refetch.

    A failure is logged and swallowed, never raised: the notifications are
    already saved, so a ring that does not get through loses nothing, and the
    client picks them up on its periodic refetch. Raised, it would turn a
    successful admin save into a 500 and fail a task whose work is committed.

    It stops at the first failure instead of trying everyone. An unreachable
    Redis does not fail fast — each send spends about four seconds on its own
    reconnection attempts — and the rings go one after another, so trying all
    of them would hold the request for four seconds per person: over an hour
    for a thousand users, with the admin's page waiting the whole time. When
    the first send fails the rest would fail the same way, so stopping costs
    nobody a notification and caps the wait at a single attempt.

    Caught here rather than with ``on_commit(..., robust=True)``: Django's
    robust handler logs through ``func.__qualname__``, which a ``partial`` does
    not have, so the logging itself would raise.
    """
    for user_id in user_ids:
        try:
            notify_user(user_id)
        except Exception:
            logger.exception(
                "Failed to ring the notification bell for user %s; "
                "skipping the remaining rings of this run",
                user_id,
            )
            return
