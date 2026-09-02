from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
_env_file = BASE_DIR.parent / ".env"
if _env_file.exists():
    environ.Env.read_env(_env_file)

# Empty credentials disable the provider.
OAUTH_PROVIDERS = {
    "google": {
        "client_id": env("GOOGLE_OAUTH_CLIENT_ID"),
        "client_secret": env("GOOGLE_OAUTH_CLIENT_SECRET"),
    },
    "github": {
        "client_id": env("GITHUB_OAUTH_CLIENT_ID"),
        "client_secret": env("GITHUB_OAUTH_CLIENT_SECRET"),
    },
}

# Browser-facing origin the OAuth redirect_url is built on.
OAUTH_REDIRECT_BASE = env("OAUTH_REDIRECT_BASE")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    # third-party
    "rest_framework",
    "django_filters",
    "channels",
    "storages",
    # local
    "apps.users",
    "apps.problems",
    "apps.contests",
    "apps.submissions",
    "apps.realtime",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

AUTH_USER_MODEL = "users.User"

# JWT authentication settings.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Django REST framework defaults.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "core.throttling.DynamicScopedRateThrottle",
    ],
    # Only views that declare a `throttle_scope` are limited; everything else
    # is untouched.
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "register": "5/hour",
        "password_change": "5/hour",
        "problem_report": "10/hour",
    },
}

# Celery (broker URLs, reliability, observability, beat schedule)
from .celery_settings import *  # noqa: F403,F401,E402,I001

CELERY_TIMEZONE = TIME_ZONE

# The single Redis address: judge queue, Celery, ticket cache, channel layer.
REDIS_URL = env("REDIS_URL")

# Cache — backs the short-lived WebSocket auth tickets (see apps.realtime).
# MUST be a shared backend (Redis), not the default LocMemCache: a ticket is
# issued over HTTP and redeemed over WS, potentially in a different worker
# process, so an in-process cache would silently fail under multiple workers.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    },
}

from .storages import *  # noqa: F403,F401,E402,I001

# Channels configuration.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

# Usernames reserved for API routes.
RESERVED_USERNAMES = {
    "me",
    "login",
    "register",
    "logout",
    "avatar",
    "token",
    "oauth",
    "standings",
}
