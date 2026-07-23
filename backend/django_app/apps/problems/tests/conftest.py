"""Shared fixtures for the problems test package.

Generic clients and users come from the project-wide ``conftest.py``; only
problem-domain fixtures live here.
"""

import pytest
from factories import make_problem


@pytest.fixture
def problem(db):
    return make_problem("Two Sum")
