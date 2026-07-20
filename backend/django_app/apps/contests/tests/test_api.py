"""Tests for the contests API: list/filter, create, join/leave, subtitle,
per-problem solved_count, problem visibility, the ?joined filter and page_size.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import update_contest_statuses
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

# api_client, user, admin, user_client and custom_admin_client come from conftest.

# ---------------------------------------------------------------------------
# Helpers & fixtures
# ---------------------------------------------------------------------------


def _contest(title="C", *, starts_in=-1, ends_in=1):
    """Contest whose start/end are `starts_in`/`ends_in` hours from now."""
    now = timezone.now()
    contest_status = (
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
        status=contest_status,
    )


def _problem(title="P"):
    return Problem.objects.create(
        title=title,
        description="statement",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
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


def _detail_url(cid):
    return reverse("contests-detail", args=[cid])


@pytest.fixture
def other(db, django_user_model):
    return django_user_model.objects.create_user(
        username="other", email="other@test.com", password="pass"
    )


@pytest.fixture
def contest(db):
    return _contest("Test Contest", starts_in=1, ends_in=3)


@pytest.fixture
def active_contest(db):
    return _contest("Active Contest", starts_in=-1, ends_in=1)


@pytest.fixture
def finished_contest(db):
    return _contest("Finished Contest", starts_in=-3, ends_in=-1)


# ---------------------------------------------------------------------------
# List tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestList:
    def test_list_returns_200(self, api_client, contest):
        response = api_client.get(reverse("contests-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_status_pending(self, api_client, contest, active_contest):
        response = api_client.get(reverse("contests-list"), {"status": "pending"})
        titles = [c["title"] for c in response.data["results"]]
        assert titles == [contest.title]  # the active one is filtered out

    def test_filter_by_status_active(self, api_client, contest, active_contest):
        response = api_client.get(reverse("contests-list"), {"status": "active"})
        titles = [c["title"] for c in response.data["results"]]
        assert titles == [active_contest.title]

    def test_ordering_by_start_time(self, db, api_client):
        _contest("Early", starts_in=1, ends_in=3)
        _contest("Late", starts_in=5, ends_in=7)
        url = reverse("contests-list")

        default_titles = [c["title"] for c in api_client.get(url).data["results"]]
        assert default_titles.index("Late") < default_titles.index("Early")

        asc = api_client.get(url, {"ordering": "start_time"}).data["results"]
        asc_titles = [c["title"] for c in asc]
        assert asc_titles.index("Early") < asc_titles.index("Late")


# ---------------------------------------------------------------------------
# Create tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestCreate:
    def test_admin_can_create(self, custom_admin_client):
        now = timezone.now()
        data = {
            "title": "New Contest",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=3)).isoformat(),
        }
        response = custom_admin_client.post(
            reverse("contests-list"), data, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Contest.objects.filter(title="New Contest").exists()

    def test_end_before_start_returns_400(self, custom_admin_client):
        now = timezone.now()
        data = {
            "title": "Bad Contest",
            "start_time": (now + timedelta(hours=3)).isoformat(),
            "end_time": (now + timedelta(hours=1)).isoformat(),
        }
        response = custom_admin_client.post(
            reverse("contests-list"), data, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_regular_user_cannot_create(self, user_client):
        now = timezone.now()
        data = {
            "title": "Hack",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=2)).isoformat(),
        }
        response = user_client.post(reverse("contests-list"), data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Subtitle
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_subtitle_in_list_and_detail(user_client, active_contest):
    active_contest.subtitle = "Round 1 · Div. 2"
    active_contest.save()
    body = user_client.get(reverse("contests-list")).json()
    assert body["results"][0]["subtitle"] == "Round 1 · Div. 2"
    detail = user_client.get(_detail_url(active_contest.id)).json()
    assert detail["subtitle"] == "Round 1 · Div. 2"


@pytest.mark.django_db
def test_admin_can_write_subtitle(custom_admin_client):
    now = timezone.now()
    resp = custom_admin_client.post(
        reverse("contests-list"),
        {
            "title": "C",
            "subtitle": "Round 2 · Div. 1",
            "start_time": now + timedelta(hours=1),
            "end_time": now + timedelta(hours=3),
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Contest.objects.get(pk=resp.json()["id"]).subtitle == "Round 2 · Div. 1"


# ---------------------------------------------------------------------------
# Join tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestJoin:
    def test_user_can_join_pending_contest(self, user_client, contest, user):
        url = reverse("contests-join", args=[contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert contest.participants.filter(pk=user.pk).exists()

    def test_user_can_join_active_contest(self, user_client, active_contest, user):
        url = reverse("contests-join", args=[active_contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_200_OK

    def test_user_cannot_join_finished_contest(self, user_client, finished_contest):
        url = reverse("contests-join", args=[finished_contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_join_twice(self, user_client, contest, user):
        contest.participants.add(user)
        url = reverse("contests-join", args=[contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_join(self, api_client, contest):
        url = reverse("contests-join", args=[contest.pk])
        response = api_client.post(url)
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]


# ---------------------------------------------------------------------------
# Leave tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestLeave:
    def test_user_can_leave_pending_contest(self, user_client, contest, user):
        contest.participants.add(user)
        url = reverse("contests-leave", args=[contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert not contest.participants.filter(pk=user.pk).exists()

    def test_user_cannot_leave_active_contest(self, user_client, active_contest, user):
        active_contest.participants.add(user)
        url = reverse("contests-leave", args=[active_contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_leave_if_not_joined(self, user_client, contest):
        url = reverse("contests-leave", args=[contest.pk])
        response = user_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Per-problem solved_count (contest detail)
# ---------------------------------------------------------------------------


def _detail_problems(client, contest):
    return client.get(_detail_url(contest.id)).json()["problems"]


@pytest.mark.django_db
def test_solved_count_distinct_per_user(user_client, user):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    _sub(user, p, c, Submission.Verdict.AC)  # same user, twice

    assert _detail_problems(user_client, c)[0]["solved_count"] == 1


@pytest.mark.django_db
def test_solved_count_two_users(user_client, user, other):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    _sub(other, p, c, Submission.Verdict.AC)

    assert _detail_problems(user_client, c)[0]["solved_count"] == 2


@pytest.mark.django_db
def test_solved_count_ignores_non_ac(user_client, user, other):
    c = _contest("Live", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.WA)
    _sub(other, p, c, Submission.Verdict.TLE)

    assert _detail_problems(user_client, c)[0]["solved_count"] == 0


@pytest.mark.django_db
def test_solved_count_ignores_other_and_no_contest(user_client, user):
    c = _contest("Live", starts_in=-1, ends_in=1)
    elsewhere = _contest("Other", starts_in=-1, ends_in=1)
    p = _problem("A")
    c.problems.add(p)
    elsewhere.problems.add(p)
    _sub(user, p, None, Submission.Verdict.AC)  # solo solve, contest=None
    _sub(user, p, elsewhere, Submission.Verdict.AC)  # AC in a different contest

    assert _detail_problems(user_client, c)[0]["solved_count"] == 0


@pytest.mark.django_db
def test_solved_count_zero_without_submissions(user_client):
    c = _contest("Live", starts_in=-1, ends_in=1)
    c.problems.add(_problem("A"))
    assert _detail_problems(user_client, c)[0]["solved_count"] == 0


# ---------------------------------------------------------------------------
# Problem visibility (hidden until the contest starts)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_problems_hidden_before_start(user_client):
    c = _contest("Future", starts_in=1, ends_in=3)  # not started
    c.problems.add(_problem("Secret A"), _problem("Secret B"))

    body = user_client.get(_detail_url(c.id)).json()
    assert body["problems"] == []
    assert body["problems_count"] == 2  # count stays honest
    # no statement leaks anywhere in the payload
    assert "Secret" not in user_client.get(_detail_url(c.id)).content.decode()


@pytest.mark.django_db
def test_problems_visible_when_active_and_finished(user_client):
    for title, s, e in [("Live", -1, 1), ("Done", -3, -1)]:
        c = _contest(title, starts_in=s, ends_in=e)
        c.problems.add(_problem(f"{title}-A"))
        assert len(user_client.get(_detail_url(c.id)).json()["problems"]) == 1


# ---------------------------------------------------------------------------
# ?joined=true filter
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_joined_filter_only_mine(user_client, user, other):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    theirs = _contest("Theirs", starts_in=1, ends_in=3)
    mine.participants.add(user)
    theirs.participants.add(other)

    body = user_client.get(reverse("contests-list"), {"joined": "true"}).json()
    assert [r["title"] for r in body["results"]] == ["Mine"]


@pytest.mark.django_db
def test_joined_combines_with_status(user_client, user):
    pending = _contest("Pending", starts_in=1, ends_in=3)
    finished = _contest("Finished", starts_in=-3, ends_in=-1)
    pending.participants.add(user)
    finished.participants.add(user)

    body = user_client.get(
        reverse("contests-list"), {"joined": "true", "status": "pending"}
    ).json()
    assert [r["title"] for r in body["results"]] == ["Pending"]


@pytest.mark.django_db
def test_joined_anonymous_empty_not_500(api_client, user):
    c = _contest("C", starts_in=1, ends_in=3)
    c.participants.add(user)
    resp = api_client.get(reverse("contests-list"), {"joined": "true"})
    assert resp.status_code == 200
    assert resp.json()["results"] == []


@pytest.mark.django_db
def test_joined_garbage_value_ignored(user_client, user):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    _contest("Other", starts_in=1, ends_in=3)
    mine.participants.add(user)
    # "yes" is not "true" -> filter ignored -> both contests returned
    body = user_client.get(reverse("contests-list"), {"joined": "yes"}).json()
    assert {r["title"] for r in body["results"]} == {"Mine", "Other"}


# ---------------------------------------------------------------------------
# page_size (contest list)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_page_size_client_controlled(user_client):
    for i in range(6):
        _contest(f"C{i}", starts_in=1, ends_in=3)
    page1 = user_client.get(reverse("contests-list"), {"page_size": 5}).json()
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = user_client.get(reverse("contests-list"), {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1


@pytest.mark.django_db
def test_list_default_page_size_20(user_client):
    for i in range(25):
        _contest(f"C{i}", starts_in=1, ends_in=3)
    page1 = user_client.get(reverse("contests-list")).json()
    assert len(page1["results"]) == 20
    assert page1["next"] is not None


@pytest.mark.django_db
def test_list_page_size_capped_at_50(user_client):
    Contest.objects.bulk_create(
        Contest(
            title=f"C{i}",
            start_time=timezone.now() + timedelta(hours=1),
            end_time=timezone.now() + timedelta(hours=3),
        )
        for i in range(51)
    )
    body = user_client.get(reverse("contests-list"), {"page_size": 999}).json()
    assert len(body["results"]) == 50  # max_page_size, not 999


# ---------------------------------------------------------------------------
# Status task (moves to test_tasks)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestStatus:
    @patch("apps.contests.tasks.Redis")
    def test_celery_task_updates_statuses_in_bulk(self, mock_redis, db):
        now = timezone.now()
        pending = Contest.objects.create(
            title="Pending",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            status=Contest.Status.FINISHED,
        )
        active = Contest.objects.create(
            title="Active",
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=1),
            status=Contest.Status.PENDING,
        )
        finished = Contest.objects.create(
            title="Finished",
            start_time=now - timedelta(hours=3),
            end_time=now - timedelta(hours=1),
            status=Contest.Status.ACTIVE,
        )

        update_contest_statuses()

        pending.refresh_from_db()
        active.refresh_from_db()
        finished.refresh_from_db()

        assert pending.status == Contest.Status.PENDING
        assert active.status == Contest.Status.ACTIVE
        assert finished.status == Contest.Status.FINISHED
