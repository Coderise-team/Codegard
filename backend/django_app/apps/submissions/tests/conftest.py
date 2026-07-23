"""Shared fixtures for the submissions test package.

Generic clients and users (``api_client``, ``user``, ``user_client``, ``redis``)
come from the project-wide ``conftest.py``; only what several submissions
modules need lives here.
"""

import pytest
from factories import make_contest, make_problem


@pytest.fixture
def problem(db):
    return make_problem("Two Sum")


@pytest.fixture
def active_contest(db, problem):
    """A running contest that already holds ``problem``."""
    contest = make_contest("Active Contest")
    contest.problems.add(problem)
    return contest
