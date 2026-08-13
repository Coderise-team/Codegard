# ruff: noqa: F403, F405
from .base import *

DEBUG = True

SECRET_KEY = env(
    "SECRET_KEY", default="django-insecure-dev-only-do-not-use-in-production"
)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

DATABASES = {
    "default": env.db(
        "DATABASE_URL", default="postgres://postgres:postgres@localhost:5432/codegard"
    )
}

INTERNAL_IPS = ["127.0.0.1"]

# Only needed when the browser talks to port 8000 directly; through the Vite
# proxy the app and the API share an origin and CORS never comes up.
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]

INSTALLED_APPS += ["debug_toolbar"]

_security_idx = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
MIDDLEWARE.insert(_security_idx + 1, "debug_toolbar.middleware.DebugToolbarMiddleware")
