from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.contests.tasks import update_contest_statuses
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_contest(db, title="Test Contest", status_offset_hours=1, duration_hours=2):
    """Creates a contest that starts in `status_offset_hours` hours."""
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now + timedelta(hours=status_offset_hours),
        end_time=now + timedelta(hours=status_offset_hours + duration_hours),
    )


def make_active_contest(db, title="Active Contest"):
    """Creates a currently active contest."""
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        status=Contest.Status.ACTIVE,
    )


def make_finished_contest(db, title="Finished Contest"):
    """Creates a finished contest."""
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
        status=Contest.Status.FINISHED,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )


@pytest.fixture
def admin(db, django_user_model):
    return django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin):
    api_client.force_authenticate(user=admin)
    return api_client


@pytest.fixture
def contest(db):
    return make_contest(db)


@pytest.fixture
def active_contest(db):
    return make_active_contest(db)


@pytest.fixture
def finished_contest(db):
    return make_finished_contest(db)


# ---------------------------------------------------------------------------
# List tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestList:
    def test_list_returns_200(self, api_client, contest):
        url = reverse("contests-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_status_pending(self, api_client, contest):
        url = reverse("contests-list")
        response = api_client.get(url, {"status": "pending"})
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_status_active(self, api_client, active_contest):
        url = reverse("contests-list")
        response = api_client.get(url, {"status": "active"})
        results = response.data.get("results", response.data)
        assert any(c["status"] == "active" for c in results)

    def test_ordering_by_start_time(self, db, api_client):
        make_contest(db, title="Early", status_offset_hours=1)
        make_contest(db, title="Late", status_offset_hours=5)
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
    def test_admin_can_create(self, admin_client):
        now = timezone.now()
        url = reverse("contests-list")
        data = {
            "title": "New Contest",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=3)).isoformat(),
        }
        response = admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Contest.objects.filter(title="New Contest").exists()

    def test_end_before_start_returns_400(self, admin_client):
        now = timezone.now()
        url = reverse("contests-list")
        data = {
            "title": "Bad Contest",
            "start_time": (now + timedelta(hours=3)).isoformat(),
            "end_time": (now + timedelta(hours=1)).isoformat(),
        }
        response = admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_regular_user_cannot_create(self, auth_client):
        now = timezone.now()
        url = reverse("contests-list")
        data = {
            "title": "Hack",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=2)).isoformat(),
        }
        response = auth_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Join tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestJoin:
    def test_user_can_join_pending_contest(self, auth_client, contest, user):
        url = reverse("contests-join", args=[contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert contest.participants.filter(pk=user.pk).exists()

    def test_user_cannot_join_active_contest(self, auth_client, active_contest):
        url = reverse("contests-join", args=[active_contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_join_finished_contest(self, auth_client, finished_contest):
        url = reverse("contests-join", args=[finished_contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_join_twice(self, auth_client, contest, user):
        contest.participants.add(user)
        url = reverse("contests-join", args=[contest.pk])
        response = auth_client.post(url)
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
    def test_user_can_leave_pending_contest(self, auth_client, contest, user):
        contest.participants.add(user)
        url = reverse("contests-leave", args=[contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert not contest.participants.filter(pk=user.pk).exists()

    def test_user_cannot_leave_active_contest(self, auth_client, active_contest, user):
        active_contest.participants.add(user)
        url = reverse("contests-leave", args=[active_contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_leave_finished_contest(
        self, auth_client, finished_contest, user
    ):
        finished_contest.participants.add(user)
        url = reverse("contests-leave", args=[finished_contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_cannot_leave_if_not_joined(self, auth_client, contest):
        url = reverse("contests-leave", args=[contest.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Status tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestContestStatus:
    def test_pending_contest_has_correct_status(self, contest):
        contest.update_status()
        assert contest.status == Contest.Status.PENDING

    def test_active_contest_has_correct_status(self, active_contest):
        active_contest.update_status()
        assert active_contest.status == Contest.Status.ACTIVE

    def test_finished_contest_has_correct_status(self, finished_contest):
        finished_contest.update_status()
        assert finished_contest.status == Contest.Status.FINISHED

    from unittest.mock import patch

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
