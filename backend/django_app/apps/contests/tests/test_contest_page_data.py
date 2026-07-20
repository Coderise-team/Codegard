"""Client-controlled page_size on the contest history (moves to test_history)."""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from django.urls import reverse
from django.utils import timezone

# user and user_client come from conftest.


@pytest.mark.django_db
def test_history_page_size(user_client, user):
    now = timezone.now()
    for i in range(6):
        c = Contest.objects.create(
            title=f"H{i}",
            start_time=now - timedelta(hours=i + 3),
            end_time=now - timedelta(hours=i + 1),
        )
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    url = reverse("users:user-contest-history", args=[user.username])
    page1 = user_client.get(url, {"page_size": 5}).json()
    assert page1["count"] == 6
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = user_client.get(url, {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1
