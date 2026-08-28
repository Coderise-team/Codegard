import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Max
from django.utils import timezone

from .models import DailyProblem, Problem

logger = logging.getLogger(__name__)

# Don't repeat a problem that was the daily challenge within the last N days.
# Plain in-code constant (small problem pool for now; we'll raise it later).
RECENT_DAYS = 7


@shared_task(bind=True)
def assign_daily_problem(self) -> dict:
    """
    Periodic task: assign today's daily challenge problem.

    Idempotent — if a DailyProblem already exists for today, this is a cheap
    no-op, so the daily problem never changes mid-day and overlapping runs are
    safe. Scheduled hourly (not daily) so the problem appears within an hour of
    a deploy and self-heals after a missed run; selection still happens only
    once per day (the first run with no row yet).
    """
    logger.info("[assign_daily_problem] started | task_id=%s", self.request.id)

    today = timezone.now().date()

    if DailyProblem.objects.filter(date=today).exists():
        logger.info("[assign_daily_problem] already assigned for %s", today)
        return {"created": False, "date": today.isoformat()}

    chosen = _pick_problem(today)
    if chosen is None:
        logger.warning("[assign_daily_problem] no visible problems; nothing assigned")
        return {"created": False, "reason": "no problems"}

    # get_or_create + unique(date) close the race if two runs overlap.
    obj, created = DailyProblem.objects.get_or_create(
        date=today, defaults={"problem": chosen}
    )
    logger.info(
        "[assign_daily_problem] done | date=%s problem=%s created=%s",
        today,
        obj.problem_id,
        created,
    )
    return {"created": created, "date": today.isoformat(), "problem_id": obj.problem_id}


def _pick_problem(today):
    """Pick a problem for `today`, avoiding ones used in the last RECENT_DAYS.

    Falls back to the least-recently-used problem when the whole pool was used
    within the window (pool <= RECENT_DAYS). Returns None only if there are no
    visible problems at all.

    Both branches skip hidden problems: the daily challenge publishes a full
    statement to everyone, which would give away a problem saved for a contest.
    """
    pool = Problem.objects.filter(is_hidden=False)

    recent_ids = DailyProblem.objects.filter(
        date__gte=today - timedelta(days=RECENT_DAYS)
    ).values_list("problem_id", flat=True)

    candidate = pool.exclude(id__in=recent_ids).order_by("?").first()
    if candidate is not None:
        return candidate

    # Pool exhausted within the window — pick the least-recently-used problem
    # (the one whose most recent daily assignment is the oldest; never-used
    # problems sort first via NULL last_used).
    return (
        pool.annotate(last_used=Max("daily_assignments__date"))
        .order_by("last_used")
        .first()
    )
