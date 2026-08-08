# ruff: noqa: F403, F405
from .base import *

DEBUG = False

SECRET_KEY = env("SECRET_KEY")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

# Origins allowed to send unsafe requests (the admin login, any form POST).
# Mandatory behind the proxy: nginx forwards X-Forwarded-Proto https, so Django
# expects an https origin and rejects everything else with 403 — an empty list
# means nobody can log into the admin. Full scheme + host, e.g.
# https://codegard.dev.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")

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
