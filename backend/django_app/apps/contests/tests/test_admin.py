"""Tests for the contests admin — rating_applied is not the admin's to set."""

import pytest
from apps.contests.admin import ContestAdmin
from apps.contests.models import Contest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from django.utils import timezone
from factories import make_contest


class _FakeUser:
    is_active = is_staff = is_superuser = True

    def has_perm(self, perm, obj=None):
        return True


def _admin_request():
    req = RequestFactory().get("/")
    req.user = _FakeUser()
    return req


def _contest_data(contest, **overrides):
    """Payload for the contest admin form, in the split widgets it renders."""
    start = timezone.localtime(contest.start_time)
    end = timezone.localtime(contest.end_time)
    data = {
        "title": contest.title,
        "subtitle": contest.subtitle,
        "start_time_0": start.date().isoformat(),
        "start_time_1": start.time().isoformat(),
        "end_time_0": end.date().isoformat(),
        "end_time_1": end.time().isoformat(),
        "status": contest.status,
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
def test_admin_cannot_set_rating_applied():
    contest = make_contest("C")
    form_class = ContestAdmin(Contest, AdminSite()).get_form(
        _admin_request(), obj=contest
    )
    assert "rating_applied" not in form_class.base_fields

    form = form_class(
        data=_contest_data(contest, rating_applied="on"), instance=contest
    )
    assert form.is_valid(), form.errors
    form.save()

    contest.refresh_from_db()
    assert contest.rating_applied is False
