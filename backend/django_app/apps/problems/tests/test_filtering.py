"""Tests for the problems catalog: status, tag AND, ordering, combinations."""

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_problem, make_submission

LIST = reverse("problems-list")

# api_client, user, other and user_client come from conftest.


def _rows(resp):
    return resp.data.get("results", resp.data)


# --- status ----------------------------------------------------------------


@pytest.mark.django_db
def test_status_solved_attempted_todo(user_client, user):
    solved = make_problem("Solved")
    attempted = make_problem("Attempted")
    make_problem("Todo")
    make_submission(user, solved, verdict=Submission.Verdict.AC)
    make_submission(user, attempted, verdict=Submission.Verdict.WA)

    by_title = {r["title"]: r["status"] for r in _rows(user_client.get(LIST))}
    assert by_title["Solved"] == "solved"
    assert by_title["Attempted"] == "attempted"
    assert by_title["Todo"] == "todo"


@pytest.mark.django_db
def test_other_users_ac_does_not_make_me_solved(user_client, user, other):
    p = make_problem("P")
    make_submission(other, p, verdict=Submission.Verdict.AC)  # someone else solved it
    row = next(r for r in _rows(user_client.get(LIST)) if r["title"] == "P")
    assert row["status"] == "todo"


@pytest.mark.django_db
def test_anonymous_all_todo(api_client):
    make_problem("P")
    row = _rows(api_client.get(LIST))[0]
    assert row["status"] == "todo"


@pytest.mark.django_db
def test_filter_status(user_client, user):
    solved = make_problem("Solved")
    make_problem("Todo")
    make_submission(user, solved, verdict=Submission.Verdict.AC)
    titles = [r["title"] for r in _rows(user_client.get(LIST, {"status": "solved"}))]
    assert titles == ["Solved"]


# --- tag (AND) -------------------------------------------------------------


@pytest.mark.django_db
def test_tag_single(user_client):
    make_problem("Has Arrays", tags=["Arrays"])
    make_problem("No tags")
    titles = [r["title"] for r in _rows(user_client.get(LIST, {"tag": "Arrays"}))]
    assert titles == ["Has Arrays"]


@pytest.mark.django_db
def test_tag_and_requires_all(user_client):
    both = make_problem("Both", tags=["Arrays", "Hashing"])
    make_problem("Only Arrays", tags=["Arrays"])
    make_problem("Only Hashing", tags=["Hashing"])
    resp = user_client.get(LIST, {"tag": ["Arrays", "Hashing"]})
    rows = _rows(resp)
    titles = [r["title"] for r in rows]
    assert titles == ["Both"]  # only the problem with BOTH tags
    assert len(rows) == 1  # no duplicate rows from the M2M join
    assert both.id == rows[0]["id"]


@pytest.mark.django_db
def test_tag_unknown_empty(user_client):
    make_problem("P", tags=["Arrays"])
    assert _rows(user_client.get(LIST, {"tag": "Nope"})) == []


# --- ordering --------------------------------------------------------------


@pytest.mark.django_db
def test_ordering_difficulty_is_by_rank_not_alphabetical(user_client):
    make_problem("H", difficulty="hard")
    make_problem("E", difficulty="easy")
    make_problem("M", difficulty="medium")
    diffs = [
        r["difficulty"]
        for r in _rows(user_client.get(LIST, {"ordering": "difficulty"}))
    ]
    assert diffs == ["easy", "medium", "hard"]  # NOT alphabetical (easy, hard, medium)
    diffs_desc = [
        r["difficulty"]
        for r in _rows(user_client.get(LIST, {"ordering": "-difficulty"}))
    ]
    assert diffs_desc == ["hard", "medium", "easy"]


@pytest.mark.django_db
def test_ordering_acceptance_and_zero_total(user_client, user, other):
    low = make_problem("Low")  # 1 AC / 2 subs = 50%
    high = make_problem("High")  # 2 AC / 2 subs = 100%
    zero = make_problem("Zero")  # no submissions -> rate 0
    make_submission(user, low, verdict=Submission.Verdict.AC)
    make_submission(other, low, verdict=Submission.Verdict.WA)
    make_submission(user, high, verdict=Submission.Verdict.AC)
    make_submission(other, high, verdict=Submission.Verdict.AC)

    asc = [r["title"] for r in _rows(user_client.get(LIST, {"ordering": "acceptance"}))]
    # Zero-total sorts as 0 (bottom of ascending, not wrongly on top).
    assert asc.index("Zero") < asc.index("Low") < asc.index("High")
    assert zero.title == "Zero"


@pytest.mark.django_db
def test_ordering_by_name(user_client):
    make_problem("Banana")
    make_problem("Apple")
    make_problem("Cherry")
    asc = [r["title"] for r in _rows(user_client.get(LIST, {"ordering": "name"}))]
    assert asc == ["Apple", "Banana", "Cherry"]
    desc = [r["title"] for r in _rows(user_client.get(LIST, {"ordering": "-name"}))]
    assert desc == ["Cherry", "Banana", "Apple"]


@pytest.mark.django_db
def test_ordering_with_trailing_comma_is_ignored(user_client):
    # An empty ordering param (trailing/leading comma) must be skipped, not
    # mapped to an invalid field — otherwise order_by raises FieldError (500).
    make_problem("Banana")
    make_problem("Apple")
    make_problem("Cherry")
    plain = user_client.get(LIST, {"ordering": "name"})
    trailing = user_client.get(LIST, {"ordering": "name,"})
    assert trailing.status_code == 200
    assert [r["title"] for r in _rows(trailing)] == [r["title"] for r in _rows(plain)]

    # Only-commas: every param is empty, so nothing is left to order by — the
    # request must still succeed (falls back to the default catalog order).
    all_empty = user_client.get(LIST, {"ordering": ",,"})
    assert all_empty.status_code == 200
    assert len(_rows(all_empty)) == 3


@pytest.mark.django_db
def test_default_ordering_newest_first(user_client):
    first = make_problem("First")
    second = make_problem("Second")
    ids = [r["id"] for r in _rows(user_client.get(LIST))]
    assert ids.index(second.id) < ids.index(first.id)  # newest (created later) on top


# --- combination -----------------------------------------------------------


@pytest.mark.django_db
def test_combined_difficulty_tag_ordering(user_client):
    make_problem("A", difficulty="easy", tags=["Arrays"])
    make_problem("B", difficulty="hard", tags=["Arrays"])
    make_problem("C", difficulty="medium", tags=["Other"])  # excluded by tag
    resp = user_client.get(
        LIST, {"difficulty": "easy", "tag": "Arrays", "ordering": "difficulty"}
    )
    titles = [r["title"] for r in _rows(resp)]
    assert titles == ["A"]  # easy AND has Arrays
