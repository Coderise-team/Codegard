"""Shared fixtures for the realtime test package.

Generic users come from the project-wide ``conftest.py``; only what several
realtime modules need lives here.
"""

import pytest
from factories import make_problem, make_submission


@pytest.fixture
def problem(db):
    return make_problem("Two Sum")


@pytest.fixture
def submission(db, user, problem):
    """A pending submission owned by ``user`` - the thing WS clients watch."""
    return make_submission(user, problem, verdict=None)
