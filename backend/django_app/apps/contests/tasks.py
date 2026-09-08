import logging
from functools import partial

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from redis import Redis

from .models import Contest

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def update_contest_statuses(self) -> dict:
    """
    Periodic task: update contest statuses based on start/end times.

    Returns a small summary dict for logging/inspection.
    """

    logger.info("[update_contest_statuses] started | task_id=%s", self.request.id)

    now = timezone.now()

    # Finished: any contest whose end_time has passed should be finished.
    finished = Contest.objects.filter(end_time__lt=now).exclude(
        status=Contest.Status.FINISHED
    )
    # No contest_ended here: "time is up" isn't the same as "results are final".
    # The event now rides with apply_finished_contest_ratings, so viewers get
    # the ELO column filled in instead of a socket that closed a minute early.
    finished_updated = finished.update(status=Contest.Status.FINISHED, updated_at=now)

    # Active: start_time <= now <= end_time
    active = Contest.objects.filter(start_time__lte=now, end_time__gte=now).exclude(
        status=Contest.Status.ACTIVE
    )
    active_updated = active.update(status=Contest.Status.ACTIVE, updated_at=now)

    # Pending: start_time in future
    pending = Contest.objects.filter(start_time__gt=now).exclude(
        status=Contest.Status.PENDING
    )
    pending_updated = pending.update(status=Contest.Status.PENDING, updated_at=now)

    _announce_started_contests(now)

    total_current = {
        "finished": Contest.objects.filter(status=Contest.Status.FINISHED).count(),
        "active": Contest.objects.filter(status=Contest.Status.ACTIVE).count(),
        "pending": Contest.objects.filter(status=Contest.Status.PENDING).count(),
    }

    # Store previous totals in Redis so we can report net changes since the last run,
    # including contests created/edited outside this task.
    redis = Redis.from_url(settings.CELERY_BROKER_URL)
    key = "contests:status_totals"
    prev_raw = redis.hgetall(key)
    if prev_raw:
        prev = {k.decode(): int(v) for k, v in prev_raw.items()}
        delta = {k: total_current[k] - prev.get(k, 0) for k in total_current}
    else:
        delta = dict(total_current)
    redis.hset(
        key,
        mapping={k: str(v) for k, v in total_current.items()},
    )

    summary = {
        # What Celery changed in DB during this run.
        "db_updated": {
            "finished": finished_updated,
            "active": active_updated,
            "pending": pending_updated,
        },
        # Net change in totals since the previous run
        # (includes contests created/edited elsewhere).
        "delta_since_last_run": delta,
        "total_current": total_current,
    }

    logger.info(
        "update_contest_statuses db_updated=%s delta=%s total=%s",
        summary["db_updated"],
        summary["delta_since_last_run"],
        summary["total_current"],
    )

    logger.info("[update_contest_statuses] done | task_id=%s", self.request.id)

    return summary


@shared_task(bind=True)
def apply_finished_contest_ratings(self) -> dict:
    """
    Periodic task: award ELO for finished contests not yet rated.

    Filters by `end_time` (not `status`, which is a cache) and `rating_applied`,
    oldest first. Each contest is isolated in its own try so one bad contest
    doesn't sink the batch.
    """
    from .services import apply_contest_ratings

    logger.info(
        "[apply_finished_contest_ratings] started | task_id=%s", self.request.id
    )

    now = timezone.now()
    contests = list(
        Contest.objects.filter(end_time__lt=now, rating_applied=False).order_by(
            "end_time"
        )
    )

    processed = 0
    participants_updated = 0
    for contest in contests:
        try:
            participants_updated += apply_contest_ratings(contest)
            processed += 1
            # Only now are the results final. apply_contest_ratings has already
            # written the deltas and busted the leaderboard cache, so a client
            # refetching on this event sees the rated table.
            _broadcast_contest_ended([contest.pk])
        except Exception:
            logger.exception("Failed to apply ratings for contest %s", contest.pk)

    summary = {
        "contests_processed": processed,
        "participants_updated": participants_updated,
    }
    logger.info("apply_finished_contest_ratings %s", summary)
    logger.info("[apply_finished_contest_ratings] done | task_id=%s", self.request.id)
    return summary


@shared_task(bind=True)
def publish_finished_contest_problems(self) -> dict:
    """
    Periodic task: put the problems of finished contests into the catalog.

    One UPDATE over everything still hidden, not a pass per contest: the task
    compares state instead of catching the moment a round ends, so a run missed
    while the worker was down costs nothing.
    """
    from apps.problems.models import Problem

    logger.info(
        "[publish_finished_contest_problems] started | task_id=%s", self.request.id
    )

    published = Problem.objects.filter(
        is_hidden=True, contests__end_time__lt=timezone.now()
    ).update(is_hidden=False)

    summary = {"published": published}
    logger.info("publish_finished_contest_problems %s", summary)
    return summary


def _announce_started_contests(now) -> None:
    """Tell registered participants that their round is live.

    Selected by the clock alone, never by ``status``. That column is a cache
    that lags a beat interval behind — and worse, ``Contest.save()`` recomputes
    it, so an admin who creates a contest inside its own window stores it as
    ACTIVE straight away. A status-based filter would see nothing left to
    transition and would silently never announce that contest at all.

    Selecting every running contest on every run means the same event is
    offered once a minute; the ``dedup_key`` is what makes delivery
    exactly-once, and it carries the start time on purpose. A repeat at the
    same start time is a duplicate and stays silent (two beat copies, a worker
    restart); a start the admin moved is a genuinely new event and goes out
    again, which is right — people are waiting to hear when the round begins.
    """
    from apps.notifications.models import Notification
    from apps.notifications.services import create_bulk, notify_user

    to_ring: set[int] = set()
    running = Contest.objects.filter(start_time__lte=now, end_time__gte=now)
    for contest in running:
        recipients = create_bulk(
            contest.participants.values_list("id", flat=True),
            type=Notification.Type.CONTEST_STARTED,
            dedup_key=f"contest_{contest.pk}_started_"
            f"{int(contest.start_time.timestamp())}",
            title="Contest started",
            body=f"{contest.title} has started",
            link=f"/contests/{contest.pk}",
        )
        to_ring |= recipients

    # One doorbell per person for the whole run, not one per contest.
    for user_id in to_ring:
        transaction.on_commit(partial(notify_user, user_id))


def _broadcast_contest_ended(contest_ids: list[int]) -> None:
    """Push a ``contest_ended`` event to each contest's ``contest_<id>`` group so
    viewers' live pages close out."""
    from apps.realtime.broadcast import group_send
    from apps.realtime.events import ContestEvents

    for contest_id in contest_ids:
        group_send(
            f"contest_{contest_id}",
            {"type": ContestEvents.CONTEST_ENDED},
        )
