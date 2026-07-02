"""Tests for the problems catalog: status, tag AND, ordering, combinations."""

import pytest
from apps.problems.models import Problem, Tag
from apps.submissions.models import Submission
from django.urls import reverse
from rest_framework.test import APIClient

LIST = reverse("problems-list")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@t.com", password="pass"
    )


@pytest.fixture
def other(db, django_user_model):
    return django_user_model.objects.create_user(
        username="o", email="o@t.com", password="pass"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


def _p(title, difficulty="easy", tags=()):
    p = Problem.objects.create(
        title=title,
        description="",
        difficulty=difficulty,
        time_limit=1000,
        memory_limit=256,
    )
    for t in tags:
        p.tags.add(Tag.objects.get_or_create(name=t)[0])
    return p


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


def _rows(resp):
    return resp.data.get("results", resp.data)


# --- status ----------------------------------------------------------------


@pytest.mark.django_db
def test_status_solved_attempted_todo(auth_client, user):
    solved = _p("Solved")
    attempted = _p("Attempted")
    _p("Todo")
    _sub(user, solved, Submission.Verdict.AC)
    _sub(user, attempted, Submission.Verdict.WA)

    by_title = {r["title"]: r["status"] for r in _rows(auth_client.get(LIST))}
    assert by_title["Solved"] == "solved"
    assert by_title["Attempted"] == "attempted"
    assert by_title["Todo"] == "todo"


@pytest.mark.django_db
def test_other_users_ac_does_not_make_me_solved(auth_client, user, other):
    p = _p("P")
    _sub(other, p, Submission.Verdict.AC)  # someone else solved it
    row = next(r for r in _rows(auth_client.get(LIST)) if r["title"] == "P")
    assert row["status"] == "todo"


@pytest.mark.django_db
def test_anonymous_all_todo(api_client):
    _p("P")
    row = _rows(api_client.get(LIST))[0]
    assert row["status"] == "todo"


@pytest.mark.django_db
def test_filter_status(auth_client, user):
    solved = _p("Solved")
    _p("Todo")
    _sub(user, solved, Submission.Verdict.AC)
    titles = [r["title"] for r in _rows(auth_client.get(LIST, {"status": "solved"}))]
    assert titles == ["Solved"]


# --- tag (AND) -------------------------------------------------------------


@pytest.mark.django_db
def test_tag_single(auth_client):
    _p("Has Arrays", tags=["Arrays"])
    _p("No tags")
    titles = [r["title"] for r in _rows(auth_client.get(LIST, {"tag": "Arrays"}))]
    assert titles == ["Has Arrays"]


@pytest.mark.django_db
def test_tag_and_requires_all(auth_client):
    both = _p("Both", tags=["Arrays", "Hashing"])
    _p("Only Arrays", tags=["Arrays"])
    _p("Only Hashing", tags=["Hashing"])
    resp = auth_client.get(LIST, {"tag": ["Arrays", "Hashing"]})
    rows = _rows(resp)
    titles = [r["title"] for r in rows]
    assert titles == ["Both"]  # only the problem with BOTH tags
    assert len(rows) == 1  # no duplicate rows from the M2M join
    assert both.id == rows[0]["id"]


@pytest.mark.django_db
def test_tag_unknown_empty(auth_client):
    _p("P", tags=["Arrays"])
    assert _rows(auth_client.get(LIST, {"tag": "Nope"})) == []


# --- ordering --------------------------------------------------------------


@pytest.mark.django_db
def test_ordering_difficulty_is_by_rank_not_alphabetical(auth_client):
    _p("H", difficulty="hard")
    _p("E", difficulty="easy")
    _p("M", difficulty="medium")
    diffs = [
        r["difficulty"]
        for r in _rows(auth_client.get(LIST, {"ordering": "difficulty"}))
    ]
    assert diffs == ["easy", "medium", "hard"]  # NOT alphabetical (easy, hard, medium)
    diffs_desc = [
        r["difficulty"]
        for r in _rows(auth_client.get(LIST, {"ordering": "-difficulty"}))
    ]
    assert diffs_desc == ["hard", "medium", "easy"]


@pytest.mark.django_db
def test_ordering_acceptance_and_zero_total(auth_client, user, other):
    low = _p("Low")  # 1 AC / 2 subs = 50%
    high = _p("High")  # 2 AC / 2 subs = 100%
    zero = _p("Zero")  # no submissions -> rate 0
    _sub(user, low, Submission.Verdict.AC)
    _sub(other, low, Submission.Verdict.WA)
    _sub(user, high, Submission.Verdict.AC)
    _sub(other, high, Submission.Verdict.AC)

    asc = [r["title"] for r in _rows(auth_client.get(LIST, {"ordering": "acceptance"}))]
    # Zero-total sorts as 0 (bottom of ascending, not wrongly on top).
    assert asc.index("Zero") < asc.index("Low") < asc.index("High")
    assert zero.title == "Zero"


@pytest.mark.django_db
def test_default_ordering_newest_first(auth_client):
    first = _p("First")
    second = _p("Second")
    ids = [r["id"] for r in _rows(auth_client.get(LIST))]
    assert ids.index(second.id) < ids.index(first.id)  # newest (created later) on top


# --- combination -----------------------------------------------------------


@pytest.mark.django_db
def test_combined_difficulty_tag_ordering(auth_client):
    _p("A", difficulty="easy", tags=["Arrays"])
    _p("B", difficulty="hard", tags=["Arrays"])
    _p("C", difficulty="medium", tags=["Other"])  # excluded by tag
    resp = auth_client.get(
        LIST, {"difficulty": "easy", "tag": "Arrays", "ordering": "difficulty"}
    )
    titles = [r["title"] for r in _rows(resp)]
    assert titles == ["A"]  # easy AND has Arrays
