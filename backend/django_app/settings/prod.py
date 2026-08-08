# ruff: noqa: F403, F405
from .base import *

DEBUG = False

SECRET_KEY = env("SECRET_KEY")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

# Mandatory behind the proxy: nginx forwards X-Forwarded-Proto https, so Django
# expects an https origin and 403s the admin login without a match here.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")

DATABASES = {"default": env.db("DATABASE_URL")}

# Normally empty: nginx serves the app and the API from one origin, so the
# browser never makes a cross-origin call. Blanks are dropped so an empty
# variable stays an empty list instead of one bogus origin.
CORS_ALLOWED_ORIGINS = [origin for origin in env.list("CORS_ALLOWED_ORIGINS") if origin]

_redis_url = f"redis://:{env('REDIS_PASSWORD')}@redis:6379/0"

CELERY_BROKER_URL = _redis_url
CELERY_RESULT_BACKEND = _redis_url
REDIS_URL = _redis_url
# base.py built CACHES from the password-less REDIS_URL; rebuild it here so the
# ticket cache uses the authenticated prod Redis URL.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": _redis_url,
    },
}
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [_redis_url],
        },
    },
}

STATIC_ROOT = BASE_DIR / "staticfiles"

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Console only: the container's output is the log, and a file inside it would
# die with the container. Without this block Django is silent about 500s.
LOG_LEVEL = env("LOG_LEVEL")

LOGGING = {
    "version": 1,
    # Keeps loggers third-party packages set up at import time alive.
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    # Pinned to WARNING regardless of LOG_LEVEL: failed requests (500s with a
    # traceback, 4xx) and security events are the ones we can never afford to
    # miss, however quiet the rest is turned down.
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
