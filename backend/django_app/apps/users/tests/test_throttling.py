"""Rate limiting on the auth endpoints."""

import pytest
from django.core.cache import cache
from django.urls import reverse


@pytest.fixture(autouse=True)
def _clean_cache():
    """Throttle counters live in the cache; each test starts from zero."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def _tight_limits(settings):
    """Switch throttling back on, with tiny limits so the test stays fast."""
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {
            "login": "3/min",
            "register": "2/hour",
            "password_change": "2/hour",
        },
    }


@pytest.mark.django_db
def test_login_is_rate_limited(api_client, _tight_limits):
    url = reverse("users:login")
    payload = {"username": "nobody", "password": "wrong-pass"}
    for _ in range(3):
        assert api_client.post(url, payload).status_code != 429
    assert api_client.post(url, payload).status_code == 429


@pytest.mark.django_db
def test_register_is_rate_limited(api_client, _tight_limits):
    url = reverse("users:register")
    for i in range(2):
        api_client.post(
            url,
            {
                "username": f"newbie{i}",
                "email": f"newbie{i}@test.com",
                "password": "Str0ng-pass-42",
            },
        )
    resp = api_client.post(
        url,
        {
            "username": "newbie9",
            "email": "newbie9@test.com",
            "password": "Str0ng-pass-42",
        },
    )
    assert resp.status_code == 429


@pytest.mark.django_db
def test_throttling_is_off_for_other_endpoints(user_client, _tight_limits):
    """Only the three declared scopes are limited — normal work is untouched."""
    url = reverse("problems-list")
    for _ in range(10):
        assert user_client.get(url).status_code != 429
