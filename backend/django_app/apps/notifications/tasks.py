import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)

# How long a notification is kept, counted from the moment that decides it.
# Two thresholds, because the two cases are not the same: something already
# read has served its purpose and can go fairly soon, while something never
# looked at is still owed to the reader — but not forever, or the table only
# ever grows.
SEEN_RETENTION_DAYS = 30
UNSEEN_RETENTION_DAYS = 90


@shared_task(bind=True)
def cleanup_old_notifications(self) -> dict:
    """
    Periodic task: drop notifications nobody needs any more.

    Two passes rather than one combined condition, so each reads as the single
    rule it applies. Neither column leads an index, so both scan the table —
    fine once a day at the current size; a partial index on ``seen_at`` is the
    step to take if the table grows. The seen pass never touches an unseen row
    on its own: ``seen_at < cutoff`` is not true of NULL.

    Idempotent and safe to miss — it compares timestamps instead of catching a
    moment, so a run skipped while the worker was down simply clears more on
    the next one.
    """
    logger.info("[cleanup_old_notifications] started | task_id=%s", self.request.id)

    now = timezone.now()

    seen_deleted, _ = Notification.objects.filter(
        seen_at__lt=now - timedelta(days=SEEN_RETENTION_DAYS)
    ).delete()
    unseen_deleted, _ = Notification.objects.filter(
        seen_at__isnull=True,
        created_at__lt=now - timedelta(days=UNSEEN_RETENTION_DAYS),
    ).delete()

    summary = {"seen_deleted": seen_deleted, "unseen_deleted": unseen_deleted}
    logger.info("cleanup_old_notifications %s", summary)
    return summary
