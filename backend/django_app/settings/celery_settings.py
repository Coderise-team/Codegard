"""
Celery settings — all Celery configuration lives here.

Imported from settings/base.py via `from .celery_settings import *`. config/celery.py
only bootstraps `Celery()` and loads these via config_from_object(namespace="CELERY"),
so broker, reliability and the beat schedule are all kept in this single file.

Named celery_settings (not celery) to avoid confusion with config/celery.py,
which is the Celery *app* module, not its settings.
"""

import environ
from celery.schedules import crontab

env = environ.Env()

# One Redis, one variable. Separate broker/backend variables used to exist and
# were free to drift apart from the URL the judge listens on, which loses
# submissions silently.
CELERY_BROKER_URL = env("REDIS_URL")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)

# Reliability / observability
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_TRACK_STARTED = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# Periodic tasks — applied to the app via namespace="CELERY" -> beat_schedule
CELERY_BEAT_SCHEDULE = {
    "contests-update-statuses-every-minute": {
        "task": "apps.contests.tasks.update_contest_statuses",
        "schedule": crontab(minute="*"),
    },
    "contests-apply-ratings-every-minute": {
        "task": "apps.contests.tasks.apply_finished_contest_ratings",
        "schedule": crontab(minute="*"),
    },
    "flush-expired-jwt-tokens-daily": {
        "task": "apps.users.tasks.flush_expired_jwt_tokens",
        "schedule": crontab(minute=0, hour=3),
    },
    "assign-daily-problem-hourly": {
        "task": "apps.problems.tasks.assign_daily_problem",
        "schedule": crontab(minute=0),
    },
}
