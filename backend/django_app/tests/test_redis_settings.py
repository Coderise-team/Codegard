"""One Redis address for every consumer of it.

Django, Celery and the judge all talk to the same Redis. When the address was
built in several places, a mismatch pointed Django and the judge at different
instances: submissions piled up in one queue while the judge waited on another,
with no error anywhere. These tests hold the wiring to a single variable.

Reloading is done from ``settings.celery_settings`` up, because each module
reads the environment once at import time. The live ``django.conf.settings`` was
built at startup and keeps its own copy, so the rest of the suite is unaffected.
"""

import importlib

import pytest
from django.core.exceptions import ImproperlyConfigured

TEST_REDIS_URL = "redis://:pass@redis:6379/0"


def load_redis_settings(monkeypatch, redis_url=TEST_REDIS_URL):
    if redis_url is None:
        monkeypatch.delenv("REDIS_URL", raising=False)
    else:
        monkeypatch.setenv("REDIS_URL", redis_url)
    importlib.reload(importlib.import_module("settings.celery_settings"))
    return importlib.reload(importlib.import_module("settings.base"))


def test_every_consumer_shares_one_address(monkeypatch):
    base = load_redis_settings(monkeypatch)

    assert base.REDIS_URL == TEST_REDIS_URL
    assert base.CELERY_BROKER_URL == TEST_REDIS_URL
    assert base.CELERY_RESULT_BACKEND == TEST_REDIS_URL
    assert base.CACHES["default"]["LOCATION"] == TEST_REDIS_URL
    assert base.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"] == [TEST_REDIS_URL]


def test_missing_address_refuses_to_start(monkeypatch):
    with pytest.raises(ImproperlyConfigured):
        load_redis_settings(monkeypatch, redis_url=None)
