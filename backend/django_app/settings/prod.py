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

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

DATABASES = {"default": env.db("DATABASE_URL")}

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
