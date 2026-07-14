"""Tests for the contest-page / dashboard data endpoints.

Covers the five backend pieces of feat/contest-page-data:
  1. registrants list;   2. per-problem solved_count;   3. hiding problems
  before start;   4. ?joined=true list filter;   5. client-controlled page_size
  (contest list + contest history).
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

# --- fixtures & helpers ----------------------------------------------------


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def other(db, django_user_model):
    return django_user_model.objects.create_user(
        username="o", email="o@test.com", password="pass"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def anon():
    return APIClient()


def _make_user(django_user_model, name, elo=1200):
    return django_user_model.objects.create_user(
        username=name, email=f"{name}@test.com", password="pass", elo_rating=elo
    )


def _problem(title="P"):
    return Problem.objects.create(
        title=title,
        description="statement",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


def _contest(title="C", *, starts_in=-1, ends_in=1, status=None):
    """Contest whose start/end are `starts_in`/`ends_in` hours from now."""
    now = timezone.now()
    if status is None:
        status = (
            Contest.Status.PENDING
            if starts_in > 0
            else Contest.Status.ACTIVE
            if ends_in > 0
            else Contest.Status.FINISHED
        )
    return Contest.objects.create(
        title=title,
        start_time=now + timedelta(hours=starts_in),
        end_time=now + timedelta(hours=ends_in),
        status=status,
    )


def _sub(user, problem, contest, verdict=Submission.Verdict.AC):
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


def _registrants_url(cid):
    return reverse("contests-registrants", args=[cid])


def _detail_url(cid):
    return reverse("contests-detail", args=[cid])


# --- Step 1: registrants ---------------------------------------------------


@pytest.mark.django_db
def test_registrants_unknown_contest_404(client):
    assert client.get(_registrants_url(999999)).status_code == 404


@pytest.mark.django_db
def test_registrants_only_this_contest(client, django_user_model):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    theirs = _contest("Theirs", starts_in=1, ends_in=3)
    a = _make_user(django_user_model, "alice")
    b = _make_user(django_user_model, "bob")
    mine.participants.add(a)
    theirs.participants.add(b)

    names = [
        r["username"] for r in client.get(_registrants_url(mine.id)).json()["results"]
    ]
    assert names == ["alice"]  # bob is only in the other contest


@pytest.mark.django_db
def test_registrants_ordered_by_rating_then_id(client, django_user_model):
    c = _contest("C", starts_in=1, ends_in=3)
    low = _make_user(django_user_model, "low", elo=1500)
    high = _make_user(django_user_model, "high", elo=2500)
    # same rating -> deterministic by id (tie1 created before tie2)
    tie1 = _make_user(django_user_model, "tie1", elo=2000)
    tie2 = _make_user(django_user_model, "tie2", elo=2000)
    for u in (low, high, tie1, tie2):
        c.participants.add(u)

    rows = client.get(_registrants_url(c.id)).json()["results"]
    assert [r["username"] for r in rows] == ["high", "tie1", "tie2", "low"]
    assert rows[0] == {"username": "high", "elo_rating": 2500}


@pytest.mark.django_db
def test_registrants_pagination_10_per_page(client, django_user_model):
    c = _contest("C", starts_in=1, ends_in=3)
    for i in range(12):
        c.participants.add(_make_user(django_user_model, f"p{i:02d}", elo=1000 + i))

    page1 = client.get(_registrants_url(c.id)).json()
    assert page1["count"] == 12
    assert len(page1["results"]) == 10
    assert page1["next"] is not None

    page2 = client.get(_registrants_url(c.id), {"page": 2}).json()
    assert len(page2["results"]) == 2
    assert page2["next"] is None


@pytest.mark.django_db
def test_registrants_reflect_join_and_leave(client, user):
    c = _contest("C", starts_in=1, ends_in=3)  # pending -> join/leave allowed

    client.post(reverse("contests-join", args=[c.id]))
    names = [
        r["username"] for r in client.get(_registrants_url(c.id)).json()["results"]
    ]
    assert user.username in names

    client.post(reverse("contests-leave", args=[c.id]))
    names = [
        r["username"] for r in client.get(_registrants_url(c.id)).json()["results"]
    ]
    assert user.username not in names


# --- Step 2: solved_count --------------------------------------------------


def _detail_problems(client, contest):
    return client.get(_detail_url(contest.id)).json()["problems"]


@pytest.mark.django_db
def test_solved_count_distinct_per_user(client, user):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    _sub(user, p, c, Submission.Verdict.AC)  # same user, twice

    problems = _detail_problems(client, c)
    assert problems[0]["solved_count"] == 1


@pytest.mark.django_db
def test_solved_count_two_users(client, user, other):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    _sub(other, p, c, Submission.Verdict.AC)

    assert _detail_problems(client, c)[0]["solved_count"] == 2


@pytest.mark.django_db
def test_solved_count_ignores_non_ac(client, user, other):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.WA)
    _sub(other, p, c, Submission.Verdict.TLE)

    assert _detail_problems(client, c)[0]["solved_count"] == 0


@pytest.mark.django_db
def test_solved_count_ignores_other_and_no_contest(client, user):
    c = _contest("Live", starts_in=-1, ends_in=1)
    elsewhere = _contest("Other", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    elsewhere.problems.add(p)
    _sub(user, p, None, Submission.Verdict.AC)  # solo solve, contest=None
    _sub(user, p, elsewhere, Submission.Verdict.AC)  # AC in a different contest

    assert _detail_problems(client, c)[0]["solved_count"] == 0


@pytest.mark.django_db
def test_solved_count_zero_without_submissions(client):
    c = _contest("Live", starts_in=-1, ends_in=1)
    c.problems.add(_problem("A"))
    assert _detail_problems(client, c)[0]["solved_count"] == 0


@pytest.mark.django_db
def test_list_still_works(client):
    _contest("Live", starts_in=-1, ends_in=1)
    resp = client.get(reverse("contests-list"))
    assert resp.status_code == 200
    assert "results" in resp.json()


# --- Step 3: hide problems before start ------------------------------------


@pytest.mark.django_db
def test_problems_hidden_before_start(client):
    c = _contest("Future", starts_in=1, ends_in=3)  # not started
    c.problems.add(_problem("Secret A"), _problem("Secret B"))

    body = client.get(_detail_url(c.id)).json()
    assert body["problems"] == []
    assert body["problems_count"] == 2  # count stays honest
    # no statement leaks anywhere in the payload
    assert "Secret" not in client.get(_detail_url(c.id)).content.decode()


@pytest.mark.django_db
def test_problems_visible_when_active_and_finished(client):
    for title, s, e in [("Live", -1, 1), ("Done", -3, -1)]:
        c = _contest(title, starts_in=s, ends_in=e)
        c.problems.add(_problem(f"{title}-A"))
        assert len(client.get(_detail_url(c.id)).json()["problems"]) == 1


# --- Step 4: ?joined=true --------------------------------------------------


@pytest.mark.django_db
def test_joined_filter_only_mine(client, user, other):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    theirs = _contest("Theirs", starts_in=1, ends_in=3)
    mine.participants.add(user)
    theirs.participants.add(other)

    titles = [
        r["title"]
        for r in client.get(reverse("contests-list"), {"joined": "true"}).json()[
            "results"
        ]
    ]
    assert titles == ["Mine"]


@pytest.mark.django_db
def test_joined_combines_with_status(client, user):
    pending = _contest("Pending", starts_in=1, ends_in=3)
    finished = _contest("Finished", starts_in=-3, ends_in=-1)
    pending.participants.add(user)
    finished.participants.add(user)

    titles = [
        r["title"]
        for r in client.get(
            reverse("contests-list"), {"joined": "true", "status": "pending"}
        ).json()["results"]
    ]
    assert titles == ["Pending"]


@pytest.mark.django_db
def test_joined_anonymous_empty_not_500(anon, user):
    c = _contest("C", starts_in=1, ends_in=3)
    c.participants.add(user)
    resp = anon.get(reverse("contests-list"), {"joined": "true"})
    assert resp.status_code == 200
    assert resp.json()["results"] == []


@pytest.mark.django_db
def test_joined_garbage_value_ignored(client, user):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    _contest("Other", starts_in=1, ends_in=3)
    mine.participants.add(user)
    # "yes" is not "true" -> filter ignored -> both contests returned
    titles = {
        r["title"]
        for r in client.get(reverse("contests-list"), {"joined": "yes"}).json()[
            "results"
        ]
    }
    assert titles == {"Mine", "Other"}


# --- Step 5: page_size (list + history) ------------------------------------


@pytest.mark.django_db
def test_list_page_size_client_controlled(client):
    for i in range(6):
        _contest(f"C{i}", starts_in=1, ends_in=3)
    page1 = client.get(reverse("contests-list"), {"page_size": 5}).json()
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = client.get(reverse("contests-list"), {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1


@pytest.mark.django_db
def test_list_default_page_size_20(client):
    for i in range(25):
        _contest(f"C{i}", starts_in=1, ends_in=3)
    page1 = client.get(reverse("contests-list")).json()
    assert len(page1["results"]) == 20
    assert page1["next"] is not None


@pytest.mark.django_db
def test_list_page_size_capped_at_50(client):
    Contest.objects.bulk_create(
        Contest(
            title=f"C{i}",
            start_time=timezone.now() + timedelta(hours=1),
            end_time=timezone.now() + timedelta(hours=3),
        )
        for i in range(51)
    )
    results = client.get(reverse("contests-list"), {"page_size": 999}).json()["results"]
    assert len(results) == 50  # max_page_size, not 999


@pytest.mark.django_db
def test_history_page_size(client, user):
    for i in range(6):
        c = _contest(f"H{i}", starts_in=-(i + 3), ends_in=-(i + 1))
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    url = reverse("users:user-contest-history", args=[user.username])
    page1 = client.get(url, {"page_size": 5}).json()
    assert page1["count"] == 6
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = client.get(url, {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1
