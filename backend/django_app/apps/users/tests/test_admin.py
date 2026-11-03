"""Tests for the user admin: the email_verified field staff can set by hand."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_change_form_shows_an_editable_email_verified(admin_client, user):
    resp = admin_client.get(reverse("admin:users_user_change", args=[user.pk]))

    assert resp.status_code == 200
    assert "email_verified" in resp.context["adminform"].form.fields


@pytest.mark.django_db
def test_changelist_filters_by_verification(admin_client, user, other):
    other.email_verified = True
    other.save(update_fields=["email_verified"])

    resp = admin_client.get(
        reverse("admin:users_user_changelist"), {"email_verified__exact": "0"}
    )

    shown = {u.username for u in resp.context["cl"].result_list}
    assert "user" in shown
    assert "other" not in shown
