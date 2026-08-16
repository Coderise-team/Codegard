from .dev import *

DEBUG = False

# Never R2: storages.py picks the backend from whatever R2 keys sit in the
# developer's own .env, which made the suite behave differently per machine and
# left an upload one oversight away from landing in the live bucket.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

CELERY_TASK_ALWAYS_EAGER = True

INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "debug_toolbar"]
MIDDLEWARE = [m for m in MIDDLEWARE if "debug_toolbar" not in m]


CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# Tests run in a single process, so an in-memory cache is enough for the
# WebSocket ticket flow (keeps CI free of a Redis dependency).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# The test cache is one process-wide dict, so throttle counters would leak
# between tests and give unrelated ones a 429. The limit test switches the
# rates back on for itself.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        "login": None,
        "register": None,
        "password_change": None,
    },
}
