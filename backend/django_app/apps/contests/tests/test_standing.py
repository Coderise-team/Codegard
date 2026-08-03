"""Tests for my standing in a contest: GET /api/contests/{id}/my-standing/.

Covers the per-problem statuses (solved / attempted / open), the rank, the
empty state when the user has no ContestScore yet, and auth.
"""

import pytest
from apps.contests.services import calculate_score
from apps.contests.views import _leaderboard_rank
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_contest, make_problem, make_submission

# api_client, user and user_client come from conftest.


def _url(cid):
    return reverse("contests-my-standing", args=[cid])


@pytest.mark.django_db
def test_statuses_and_rank(user_client, user):
    c = make_contest("Live")
    c.participants.add(user)  # rank now comes from the participant set
    solved, attempted, untouched = (
        make_problem("A"),
        make_problem("B"),
        make_problem("C"),
    )
    c.problems.add(solved, attempted, untouched)
    make_submission(user, solved, c, Submission.Verdict.AC)
    make_submission(user, attempted, c, Submission.Verdict.WA)
    calculate_score(user, c)

    data = user_client.get(_url(c.id)).json()
    assert data["solved"] == 1
    assert data["rank"] == 1
    statuses = {p["id"]: p["status"] for p in data["problems"]}
    assert statuses[solved.id] == "solved"
    assert statuses[attempted.id] == "attempted"
    assert statuses[untouched.id] == "open"


@pytest.mark.django_db
def test_no_contestscore(user_client):
    c = make_contest("Live")
    c.problems.add(make_problem("A"))

    data = user_client.get(_url(c.id)).json()
    assert data["score"] == 0
    assert data["solved"] == 0
    assert data["rank"] is None
    assert data["problems"][0]["status"] == "open"


@pytest.mark.django_db
def test_participant_no_show_gets_a_rank(user_client, user, other):
    """A joined no-show is on the leaderboard, so my-standing must place them
    too — not None — and the place must match the table."""
    c = make_contest("Live")
    p = make_problem("A")
    c.problems.add(p)
    c.participants.add(user, other)
    make_submission(other, p, c, Submission.Verdict.AC)  # other scores, user no-show
    calculate_score(other, c)

    data = user_client.get(_url(c.id)).json()
    assert data["score"] == 0
    assert data["rank"] == 2  # last place, below the one who solved
    assert data["rank"] == _leaderboard_rank(c, user.pk)  # agrees with the table


@pytest.mark.django_db
def test_leaderboard_rank_none_when_user_absent(user):
    c = make_contest("Live")  # user is not a participant → not on the leaderboard
    assert _leaderboard_rank(c, user.pk) is None


@pytest.mark.django_db
def test_requires_auth(api_client):
    c = make_contest("Live")
    assert api_client.get(_url(c.id)).status_code in (401, 403)
