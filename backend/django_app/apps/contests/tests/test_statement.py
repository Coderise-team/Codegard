"""Tests for the statement a started contest ships with each of its problems.

The catalog serves no hidden problem to anyone, so this payload is where a
participant's statement comes from.
"""

import pytest
from apps.problems.models import TestCase
from django.urls import reverse
from factories import make_contest, make_problem


@pytest.fixture
def live_contest(db):
    """A running round holding one hidden problem with a full statement."""
    problem = make_problem("Sum", tags=["math"], is_hidden=True)
    problem.input_format = "one line with n"
    problem.output_format = "one number"
    problem.constraints = "1 <= n <= 10"
    problem.save()
    TestCase.objects.create(problem=problem, input="1 2", expected_output="3")
    TestCase.objects.create(
        problem=problem, input="99 1", expected_output="100", is_hidden=True
    )

    contest = make_contest("Live")
    contest.problems.add(problem)
    return contest


def _first_problem(client, contest):
    return client.get(reverse("contests-detail", args=[contest.pk])).json()["problems"][
        0
    ]


@pytest.mark.django_db
def test_started_contest_ships_the_whole_statement(user_client, live_contest):
    row = _first_problem(user_client, live_contest)

    assert row["input_format"] == "one line with n"
    assert row["output_format"] == "one number"
    assert row["constraints"] == "1 <= n <= 10"
    assert row["tags"] == ["math"]
    assert row["acceptance"] == 0.0


@pytest.mark.django_db
def test_examples_ship_but_judge_only_tests_do_not(user_client, live_contest):
    row = _first_problem(user_client, live_contest)

    assert [case["input"] for case in row["test_cases"]] == ["1 2"]


@pytest.mark.django_db
def test_a_long_round_costs_no_extra_queries(
    user_client, live_contest, django_assert_max_num_queries
):
    # Tags and examples ride prefetches, so the query count must not grow with
    # the number of problems in the round.
    for i in range(5):
        problem = make_problem(f"Extra {i}", tags=["math"], is_hidden=True)
        TestCase.objects.create(problem=problem, input="1", expected_output="1")
        live_contest.problems.add(problem)

    with django_assert_max_num_queries(8):
        user_client.get(reverse("contests-detail", args=[live_contest.pk]))
