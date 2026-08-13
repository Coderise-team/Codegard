# ruff: noqa: F403, F405
from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

# Uploaded files (avatars) must live in R2 here. Nothing serves /media/ in
# production — Django only hands files out under DEBUG, and nginx answers an
# image request with the app shell — so a deploy without R2 would write files
# onto the container's disk where nobody can ever read them, and avatars would
# quietly stop appearing. Fail at startup instead.
if not R2_ENABLED:
    raise ImproperlyConfigured(
        "R2 storage is required in production: set R2_ACCOUNT_ID, "
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME."
    )

SECRET_KEY = env("SECRET_KEY")

# "localhost" is for the in-container health check only; outside traffic
# arrives through nginx, which matches on the real domain.
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS") + ["localhost"]

# Mandatory behind the proxy: nginx forwards X-Forwarded-Proto https, so Django
# expects an https origin and 403s the admin login without a match here.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")

DATABASES = {"default": env.db("DATABASE_URL")}

# Normally empty: nginx serves the app and the API from one origin, so the
# browser never makes a cross-origin call. Blanks are dropped so an empty
# variable stays an empty list instead of one bogus origin.
CORS_ALLOWED_ORIGINS = [origin for origin in env.list("CORS_ALLOWED_ORIGINS") if origin]

# First in the chain: everything downstream reads REMOTE_ADDR already corrected.
MIDDLEWARE = ["core.middleware.RealClientIPMiddleware", *MIDDLEWARE]

STATIC_ROOT = BASE_DIR / "staticfiles"

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
# The container health check talks to Django over plain http inside the
# network, so it must not be bounced to https.
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]
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
