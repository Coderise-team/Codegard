"""Shared fixtures for the contests test package.

Generic clients and users (``api_client``, ``user``, ``other``, ``admin``,
``user_client``, ``custom_admin_client``) come from the project-wide
``conftest.py``; only what several contests modules need lives here.

Objects a test builds itself (several problems, a contest at a given time) come
from ``factories.py``.
"""

import pytest
from factories import make_contest, make_problem


@pytest.fixture
def users(db, django_user_model):
    """Three users - enough to rank a field and still have a no-show."""
    return [
        django_user_model.objects.create_user(
            username=f"u{i}", email=f"u{i}@t.com", password="pass"
        )
        for i in range(3)
    ]


@pytest.fixture
def problems(db):
    """Two problems, so "solved one of two" scenarios are possible."""
    return [make_problem(f"P{i}") for i in range(2)]


@pytest.fixture
def finished_contest(db):
    """A contest that ran from three hours ago until an hour ago."""
    return make_contest("Finished", starts_in=-3, ends_in=-1)
