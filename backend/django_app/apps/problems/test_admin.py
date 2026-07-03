"""Tests for the problems admin — an incomplete problem must not save."""

import pytest
from apps.problems.admin import ProblemAdmin, ProblemAdminForm
from apps.problems.admin import TestCaseInline as _TestCaseInline
from apps.problems.models import DailyProblem, Problem, Tag, TestCase
from django.contrib import admin as django_admin
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory


@pytest.fixture
def tag(db):
    return Tag.objects.get_or_create(name="dp")[0]


class _FakeUser:
    is_active = is_staff = is_superuser = True

    def has_perm(self, perm, obj=None):
        return True


def _admin_request():
    req = RequestFactory().get("/")
    req.user = _FakeUser()
    return req


def _problem_data(**overrides):
    data = {
        "title": "Two Sum",
        "description": "desc",
        "input_format": "n",
        "output_format": "sum",
        "constraints": "1 <= n <= 10",
        "difficulty": Problem.Difficulty.EASY,
        "time_limit": 1000,
        "memory_limit": 256,
    }
    data.update(overrides)
    return data


# --- tags required (custom form) -------------------------------------------


@pytest.mark.django_db
def test_form_without_tags_is_invalid():
    form = ProblemAdminForm(data=_problem_data())  # no tags
    assert not form.is_valid()
    assert "tags" in form.errors


@pytest.mark.django_db
def test_form_with_one_tag_is_valid(tag):
    form = ProblemAdminForm(data=_problem_data(tags=[tag.pk]))
    assert form.is_valid(), form.errors


# --- test cases required (inline formset min_num + validate_min) ------------


def _inline_formset(rows):
    """Build the TestCase inline formset with `rows` data rows."""
    inline = _TestCaseInline(Problem, AdminSite())
    FormSet = inline.get_formset(request=_admin_request())
    prefix = "test_cases"
    data = {
        f"{prefix}-TOTAL_FORMS": str(len(rows)),
        f"{prefix}-INITIAL_FORMS": "0",
        f"{prefix}-MIN_NUM_FORMS": "1",
        f"{prefix}-MAX_NUM_FORMS": "1000",
    }
    for i, row in enumerate(rows):
        for key, value in row.items():
            data[f"{prefix}-{i}-{key}"] = value
    return FormSet(data=data, prefix=prefix)


@pytest.mark.django_db
def test_inline_zero_test_cases_is_invalid():
    formset = _inline_formset([])  # no test cases
    assert not formset.is_valid()  # validate_min forbids fewer than min_num=1


@pytest.mark.django_db
def test_inline_one_test_case_is_valid():
    formset = _inline_formset([{"input": "1", "expected_output": "2", "is_hidden": ""}])
    assert formset.is_valid(), formset.errors + [formset.non_form_errors()]


@pytest.mark.django_db
def test_inline_partial_row_shows_per_row_error_not_min():
    # A half-filled row (missing expected_output) is a per-row error; clean()
    # returns early and lets that surface instead of the "at least one" message.
    formset = _inline_formset([{"input": "1", "expected_output": "", "is_hidden": ""}])
    assert not formset.is_valid()
    assert not formset.non_form_errors()  # min-error suppressed; row error shown
    assert formset.errors[0]  # the row itself is invalid


# --- model registration -----------------------------------------------------


def test_tag_and_dailyproblem_registered():
    assert django_admin.site.is_registered(Tag)
    assert django_admin.site.is_registered(DailyProblem)
    assert django_admin.site.is_registered(Problem)


# --- computed columns -------------------------------------------------------


@pytest.mark.django_db
def test_computed_columns(tag):
    p = Problem.objects.create(**_problem_data())
    p.tags.add(tag)
    TestCase.objects.create(problem=p, input="1", expected_output="2")
    TestCase.objects.create(problem=p, input="3", expected_output="4")

    ma = ProblemAdmin(Problem, AdminSite())
    assert ma.test_case_count(p) == 2
    assert ma.tag_list(p) == "dp"


@pytest.mark.django_db
def test_get_queryset_prefetches(tag):
    p = Problem.objects.create(**_problem_data())
    p.tags.add(tag)
    ma = ProblemAdmin(Problem, AdminSite())
    qs = ma.get_queryset(_admin_request())
    assert p in list(qs)
    # tags were prefetched, so reading them adds no extra query
    assert "tags" in qs._prefetch_related_lookups


@pytest.mark.django_db
def test_tag_list_dash_when_no_tags():
    p = Problem.objects.create(**_problem_data())
    ma = ProblemAdmin(Problem, AdminSite())
    assert ma.tag_list(p) == "—"


# --- end-to-end through the real admin -------------------------------------


def _post_data(rows, with_tag=True, tag_pk=None):
    data = dict(_problem_data())
    if with_tag:
        data["tags"] = [str(tag_pk)]
    data.update(
        {
            "test_cases-TOTAL_FORMS": str(len(rows)),
            "test_cases-INITIAL_FORMS": "0",
            "test_cases-MIN_NUM_FORMS": "0",
            "test_cases-MAX_NUM_FORMS": "1000",
        }
    )
    for i, row in enumerate(rows):
        for key, value in row.items():
            data[f"test_cases-{i}-{key}"] = value
    return data


ADD_URL = "/admin/problems/problem/add/"
_FILLED = [{"input": "1", "expected_output": "2", "is_hidden": ""}]
_EMPTY = [{"input": "", "expected_output": "", "is_hidden": ""}]


@pytest.mark.django_db
def test_admin_creates_problem_with_test_case_and_tag(admin_client, tag):
    resp = admin_client.post(ADD_URL, _post_data(_FILLED, tag_pk=tag.pk))
    assert resp.status_code == 302  # redirect on success
    p = Problem.objects.get(title="Two Sum")
    assert p.test_cases.count() == 1
    assert list(p.tags.all()) == [tag]


@pytest.mark.django_db
def test_admin_rejects_problem_without_test_cases(admin_client, tag):
    resp = admin_client.post(ADD_URL, _post_data(_EMPTY, tag_pk=tag.pk))
    assert resp.status_code == 200  # form re-rendered with the error
    assert not Problem.objects.filter(title="Two Sum").exists()


@pytest.mark.django_db
def test_admin_rejects_problem_without_tags(admin_client, tag):
    resp = admin_client.post(ADD_URL, _post_data(_FILLED, with_tag=False))
    assert resp.status_code == 200
    assert not Problem.objects.filter(title="Two Sum").exists()
