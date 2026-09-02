"""Tests for the problem-report feature: submission, the reason reference,
the staff-only reading endpoint, and the admin queue.
"""

from datetime import timedelta

import pytest
from apps.problems.admin import ProblemReportAdmin
from apps.problems.models import ProblemReport
from apps.problems.serializers import MAX_REPORT_MESSAGE_LENGTH
from django.contrib.admin.sites import AdminSite
from django.core.cache import cache
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from factories import make_problem
from rest_framework import status

# api_client, user, other, admin, user_client, custom_admin_client and
# `problem` (from apps/problems/tests/conftest.py) come from conftest.


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # ScopedRateThrottle state lives in the default cache, which is shared
    # (and not reset) across the whole test run — without this, tests that
    # POST several times per user leak quota into whichever test runs next.
    cache.clear()
    yield


def _report_url(problem_id):
    return reverse("problems-report", args=[problem_id])


REASONS_URL = reverse("report-reasons")
REPORTS_LIST_URL = reverse("reports-list")


def _valid_payload(**overrides):
    data = {
        "reason": ProblemReport.Reason.WRONG_TEST,
        "message": "On the negative-numbers test the expected output is wrong.",
    }
    data.update(overrides)
    return data


# ---- Creation (POST /api/problems/{id}/report/) ----------------------------


@pytest.mark.django_db
def test_authenticated_valid_report_creates_row(user_client, user, problem):
    resp = user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    report = ProblemReport.objects.get()
    assert report.user == user
    assert report.problem == problem
    assert report.reason == ProblemReport.Reason.WRONG_TEST
    assert report.status == ProblemReport.Status.NEW


@pytest.mark.django_db
def test_problem_title_snapshotted_at_submission(user_client, problem):
    user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    report = ProblemReport.objects.get()
    assert report.problem_title == problem.title


@pytest.mark.django_db
def test_anonymous_gets_401_and_creates_nothing(api_client, problem):
    resp = api_client.post(_report_url(problem.id), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert not ProblemReport.objects.exists()


@pytest.mark.django_db
def test_unknown_reason_is_400(user_client, problem):
    resp = user_client.post(
        _report_url(problem.id),
        _valid_payload(reason="not_a_real_reason"),
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_empty_message_is_400(user_client, problem):
    resp = user_client.post(
        _report_url(problem.id), _valid_payload(message=""), format="json"
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_too_short_message_is_400(user_client, problem):
    resp = user_client.post(
        _report_url(problem.id), _valid_payload(message="bad"), format="json"
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_nonexistent_problem_is_404(user_client):
    resp = user_client.post(_report_url(999999), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_too_long_message_is_400(user_client, problem):
    """The column is unbounded, so one request could otherwise drop megabytes
    into the triage queue."""
    too_long = "a" * (MAX_REPORT_MESSAGE_LENGTH + 1)

    resp = user_client.post(
        _report_url(problem.id), _valid_payload(message=too_long), format="json"
    )

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert not ProblemReport.objects.exists()


@pytest.mark.django_db
def test_message_is_stored_trimmed(user_client, problem):
    user_client.post(
        _report_url(problem.id),
        _valid_payload(message="   the expected output is wrong   "),
        format="json",
    )
    assert ProblemReport.objects.get().message == "the expected output is wrong"


@pytest.mark.django_db
def test_non_numeric_problem_id_is_404(user_client):
    """The router's detail pattern accepts any text, so the view has to answer
    404 rather than blow up on a id that is not a number."""
    resp = user_client.post(
        "/api/problems/not-a-number/report/", _valid_payload(), format="json"
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_hidden_problem_can_be_reported(user_client, user):
    """A running contest keeps its problems out of the catalog, and a broken
    test is exactly what a participant needs to report while the round is on."""
    hidden = make_problem("Hidden Round Problem", is_hidden=True)

    resp = user_client.post(_report_url(hidden.id), _valid_payload(), format="json")

    assert resp.status_code == status.HTTP_201_CREATED
    report = ProblemReport.objects.get()
    assert report.problem == hidden
    assert report.problem_title == hidden.title


@pytest.mark.django_db
def test_author_cannot_be_spoofed(user_client, user, other, problem):
    resp = user_client.post(
        _report_url(problem.id), _valid_payload(user=other.id), format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert ProblemReport.objects.get().user == user


@pytest.mark.django_db
def test_status_cannot_be_spoofed(user_client, problem):
    resp = user_client.post(
        _report_url(problem.id),
        _valid_payload(status=ProblemReport.Status.ACCEPTED),
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert ProblemReport.objects.get().status == ProblemReport.Status.NEW


# ---- Open-report limit (decision 5) ----------------------------------------


@pytest.mark.django_db
def test_sixth_open_report_on_same_problem_is_400(user_client, problem):
    for _ in range(5):
        resp = user_client.post(
            _report_url(problem.id), _valid_payload(), format="json"
        )
        assert resp.status_code == status.HTTP_201_CREATED

    resp = user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert ProblemReport.objects.count() == 5


@pytest.mark.django_db
def test_resolving_one_frees_up_a_slot(user_client, user, problem):
    for _ in range(5):
        user_client.post(_report_url(problem.id), _valid_payload(), format="json")

    one = ProblemReport.objects.filter(user=user, problem=problem).first()
    one.status = ProblemReport.Status.ACCEPTED
    one.save()

    resp = user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    assert ProblemReport.objects.filter(user=user, problem=problem).count() == 6


@pytest.mark.django_db
def test_limit_is_per_user(api_client, user, other, problem):
    for _ in range(5):
        api_client.force_authenticate(user=user)
        api_client.post(_report_url(problem.id), _valid_payload(), format="json")

    api_client.force_authenticate(user=other)
    resp = api_client.post(_report_url(problem.id), _valid_payload(), format="json")
    assert resp.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_limit_is_per_problem(user_client, problem):
    other_problem = make_problem("Other Problem")
    for _ in range(5):
        user_client.post(_report_url(problem.id), _valid_payload(), format="json")

    resp = user_client.post(
        _report_url(other_problem.id), _valid_payload(), format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED


# ---- Surviving deletion (decisions 9, 10) -----------------------------------


@pytest.mark.django_db
def test_report_survives_problem_deletion(user_client, problem):
    user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    title = problem.title
    problem.delete()

    report = ProblemReport.objects.get()
    assert report.problem is None
    assert report.problem_title == title


@pytest.mark.django_db
def test_report_survives_author_deletion(user_client, user, problem):
    user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    user.delete()

    report = ProblemReport.objects.get()
    assert report.user is None


@pytest.mark.django_db
def test_report_survives_resolver_deletion(user_client, admin, problem):
    user_client.post(_report_url(problem.id), _valid_payload(), format="json")
    report = ProblemReport.objects.get()
    report.status = ProblemReport.Status.ACCEPTED
    report.resolved_by = admin
    report.resolved_at = timezone.now()
    report.save()

    admin.delete()

    report.refresh_from_db()
    assert report.resolved_by is None
    assert report.status == ProblemReport.Status.ACCEPTED


# ---- Reason reference (GET /api/report-reasons/) ---------------------------


@pytest.mark.django_db
def test_reasons_list_matches_model(user_client):
    resp = user_client.get(REASONS_URL)
    assert resp.status_code == status.HTTP_200_OK
    ids = {item["id"] for item in resp.json()}
    assert ids == {value for value, _ in ProblemReport.Reason.choices}


@pytest.mark.django_db
def test_reasons_anonymous_401(api_client):
    resp = api_client.get(REASONS_URL)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_reason_code_from_reference_is_accepted(user_client, problem):
    reason_id = user_client.get(REASONS_URL).json()[0]["id"]
    resp = user_client.post(
        _report_url(problem.id), _valid_payload(reason=reason_id), format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED


# ---- Staff reading (GET /api/reports/, /api/reports/{id}/) -----------------


@pytest.mark.django_db
def test_staff_sees_list_and_detail(custom_admin_client, user, problem):
    report = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.WRONG_TEST,
        message="Something is off with the tests.",
    )

    list_resp = custom_admin_client.get(REPORTS_LIST_URL)
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.json()["count"] == 1

    detail_resp = custom_admin_client.get(reverse("reports-detail", args=[report.id]))
    assert detail_resp.status_code == status.HTTP_200_OK
    assert detail_resp.json()["problem_title"] == problem.title


@pytest.mark.django_db
def test_regular_user_gets_403_anonymous_gets_401(api_client, user, problem):
    ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="whatever, ten chars",
    )

    api_client.force_authenticate(user=user)
    assert api_client.get(REPORTS_LIST_URL).status_code == status.HTTP_403_FORBIDDEN
    assert (
        api_client.get(reverse("reports-detail", args=[1])).status_code
        == status.HTTP_403_FORBIDDEN
    )

    api_client.force_authenticate(user=None)
    assert api_client.get(REPORTS_LIST_URL).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_status_filter_only_new(custom_admin_client, user, problem):
    ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
        status=ProblemReport.Status.NEW,
    )
    ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
        status=ProblemReport.Status.ACCEPTED,
    )

    resp = custom_admin_client.get(REPORTS_LIST_URL, {"status": "new"})
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["status"] == "new"


@pytest.mark.django_db
def test_reason_filter(custom_admin_client, user, problem):
    ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.WRONG_TEST,
        message="ten characters here",
    )
    ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )

    resp = custom_admin_client.get(REPORTS_LIST_URL, {"reason": "wrong_test"})
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["reason"] == "wrong_test"


@pytest.mark.django_db
def test_list_is_paginated_and_newest_first(custom_admin_client, user, problem):
    now = timezone.now()
    older = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )
    ProblemReport.objects.filter(pk=older.pk).update(created_at=now - timedelta(days=1))
    newer = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )

    resp = custom_admin_client.get(REPORTS_LIST_URL)
    body = resp.json()
    assert "results" in body and "count" in body
    assert body["results"][0]["id"] == newer.id
    assert body["results"][1]["id"] == older.id


@pytest.mark.django_db
def test_reports_filed_in_the_same_second_keep_a_stable_order(
    custom_admin_client, user, problem
):
    """Timestamp alone is not a unique sort key, and an unstable one makes rows
    jump between pages of the queue."""
    same_moment = timezone.now()
    ids = []
    for _ in range(3):
        report = ProblemReport.objects.create(
            problem=problem,
            problem_title=problem.title,
            user=user,
            reason=ProblemReport.Reason.OTHER,
            message="ten characters here",
        )
        ProblemReport.objects.filter(pk=report.pk).update(created_at=same_moment)
        ids.append(report.id)

    first = [
        r["id"] for r in custom_admin_client.get(REPORTS_LIST_URL).json()["results"]
    ]
    second = [
        r["id"] for r in custom_admin_client.get(REPORTS_LIST_URL).json()["results"]
    ]

    assert first == second == sorted(ids)


@pytest.mark.django_db
def test_cannot_change_status_through_api(custom_admin_client, user, problem):
    report = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )
    detail_url = reverse("reports-detail", args=[report.id])

    assert (
        custom_admin_client.patch(
            detail_url, {"status": "accepted"}, format="json"
        ).status_code
        == status.HTTP_405_METHOD_NOT_ALLOWED
    )
    assert (
        custom_admin_client.delete(detail_url).status_code
        == status.HTTP_405_METHOD_NOT_ALLOWED
    )

    report.refresh_from_db()
    assert report.status == ProblemReport.Status.NEW


# ---- Admin ------------------------------------------------------------------


class _FakeUser:
    is_active = is_staff = is_superuser = True
    username = "admin"

    def has_perm(self, perm, obj=None):
        return True


def _admin_request():
    req = RequestFactory().get("/")
    req.user = _FakeUser()
    return req


@pytest.mark.django_db
def test_admin_accept_action_sets_status_and_resolver(admin_client, user, problem):
    r1 = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )
    r2 = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )

    resp = admin_client.post(
        "/admin/problems/problemreport/",
        {
            "action": "accept_reports",
            "_selected_action": [str(r1.pk), str(r2.pk)],
        },
        follow=True,
    )
    assert resp.status_code == 200

    r1.refresh_from_db()
    r2.refresh_from_db()
    for r in (r1, r2):
        assert r.status == ProblemReport.Status.ACCEPTED
        assert r.resolved_by is not None
        assert r.resolved_at is not None


@pytest.mark.django_db
def test_admin_save_model_sets_resolver_on_status_change(user, admin, problem):
    report = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )
    ma = ProblemReportAdmin(ProblemReport, AdminSite())
    request = RequestFactory().get("/")
    request.user = admin

    report.status = ProblemReport.Status.REJECTED

    class _Form:
        changed_data = ["status"]

    ma.save_model(request, report, _Form(), change=True)

    assert report.resolved_by == admin
    assert report.resolved_at is not None


@pytest.mark.django_db
def test_admin_save_model_clears_resolver_when_reopened(user, admin, problem):
    report = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
        status=ProblemReport.Status.ACCEPTED,
        resolved_by=admin,
        resolved_at=timezone.now(),
    )
    ma = ProblemReportAdmin(ProblemReport, AdminSite())
    request = RequestFactory().get("/")
    request.user = admin

    report.status = ProblemReport.Status.NEW

    class _Form:
        changed_data = ["status"]

    ma.save_model(request, report, _Form(), change=True)

    assert report.resolved_by is None
    assert report.resolved_at is None


@pytest.mark.django_db
def test_new_report_has_empty_resolution_fields(user, problem):
    report = ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.OTHER,
        message="ten characters here",
    )
    assert report.resolved_by is None
    assert report.resolved_at is None


def test_model_registered():
    from django.contrib import admin as django_admin

    assert django_admin.site.is_registered(ProblemReport)


def test_admin_has_no_add_permission():
    ma = ProblemReportAdmin(ProblemReport, AdminSite())
    assert ma.has_add_permission(_admin_request()) is False
