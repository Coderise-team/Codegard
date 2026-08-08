"""Contract of the production settings module.

``settings/prod.py`` is never exercised by the rest of the suite (tests run on
``settings.test``), yet every value in it is read at import time — a missing or
malformed variable is a container that refuses to boot on the server, not a
failing request. These tests reload the module against a controlled environment
so that failure shows up in CI instead.

Only the variables prod.py itself reads are set here: ``settings.base`` is
already imported by the test settings, so its own environment reads are cached
and unaffected by the reload.
"""

import importlib

import pytest
from django.core.exceptions import ImproperlyConfigured

PROD_ENV = {
    "SECRET_KEY": "prod-settings-test-key",
    "ALLOWED_HOSTS": "codegard.dev,www.codegard.dev",
    "CSRF_TRUSTED_ORIGINS": "https://codegard.dev,https://www.codegard.dev",
    "DATABASE_URL": "postgres://user:pass@postgres:5432/codegard",
    "REDIS_PASSWORD": "redis-pass",
}


def load_prod_settings(monkeypatch, **overrides):
    """Import ``settings.prod`` fresh against ``PROD_ENV`` plus ``overrides``.

    A value of ``None`` removes the variable, which is how the "operator forgot
    to set it" case is expressed.
    """
    for name, value in {**PROD_ENV, **overrides}.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    return importlib.reload(importlib.import_module("settings.prod"))


def test_csrf_trusted_origins_read_from_env(monkeypatch):
    prod = load_prod_settings(monkeypatch)

    assert prod.CSRF_TRUSTED_ORIGINS == [
        "https://codegard.dev",
        "https://www.codegard.dev",
    ]


def test_missing_csrf_trusted_origins_refuses_to_start(monkeypatch):
    """No silent default: booting without the list would 403 every admin login."""
    with pytest.raises(ImproperlyConfigured):
        load_prod_settings(monkeypatch, CSRF_TRUSTED_ORIGINS=None)
