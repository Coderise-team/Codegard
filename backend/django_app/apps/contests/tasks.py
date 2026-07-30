import logging

from celery import shared_task
from django.conf import settings
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
