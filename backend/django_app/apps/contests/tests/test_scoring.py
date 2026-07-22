from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from apps.contests.services import calculate_score, get_leaderboard
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from .factories import make_submission

# ---------------------------------------------------------------------------
# Fixtures (api_client, user and other come from conftest)
# ---------------------------------------------------------------------------


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="",
        difficulty="easy",
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def problem2(db):
    return Problem.objects.create(
        title="Reverse String",
        description="",
        difficulty="easy",
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def active_contest(db, problem, problem2):
    now = timezone.now()
    contest = Contest.objects.create(
        title="Active Contest",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        status=Contest.Status.ACTIVE,
    )
    contest.problems.add(problem, problem2)
    return contest


def submit_at(user, problem, contest, verdict, minutes_after_start=10):
    """A submission pinned to a given minute after the contest start.

    Not ``factories.make_submission``: penalty is measured from the contest
    start, so these tests need control over ``created_at``.
    """
    created_at = contest.start_time + timedelta(minutes=minutes_after_start)
    submission = make_submission(user, problem, contest, verdict)
    # `created_at` is `auto_now_add=True`, so update it explicitly for scoring tests.
    Submission.objects.filter(pk=submission.pk).update(created_at=created_at)
    submission.created_at = created_at
    return submission


# ---------------------------------------------------------------------------
# calculate_score tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCalculateScore:
    def test_no_submissions_score_is_zero(self, user, active_contest):
        score = calculate_score(user, active_contest)
        assert score.score == 0
        assert score.penalty == 0
        assert score.solved_count == 0

    def test_ac_submission_gives_100_points(self, user, problem, active_contest):
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=10,
        )
        score = calculate_score(user, active_contest)
        assert score.score == 100
        assert score.solved_count == 1

    def test_time_penalty_calculated_correctly(self, user, problem, active_contest):
        # AC at 30 minutes after start → penalty = 30 minutes
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=30,
        )
        score = calculate_score(user, active_contest)
        assert score.penalty == 30

    def test_wrong_attempt_adds_10_minutes_penalty(self, user, problem, active_contest):
        # 1 WA at 5 min, then AC at 30 min → penalty = 30 + 10 = 40
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.WA,
            minutes_after_start=5,
        )
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=30,
        )
        score = calculate_score(user, active_contest)
        assert score.penalty == 40

    def test_multiple_wrong_attempts(self, user, problem, active_contest):
        # 3 WA then AC at 20 min → penalty = 20 + 3*10 = 50
        for m in [5, 8, 12]:
            submit_at(
                user,
                problem,
                active_contest,
                Submission.Verdict.WA,
                minutes_after_start=m,
            )
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=20,
        )
        score = calculate_score(user, active_contest)
        assert score.penalty == 50

    def test_wa_after_ac_not_counted(self, user, problem, active_contest):
        # AC at 10 min, then WA at 20 min → penalty = 10 (WA after AC ignored)
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=10,
        )
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.WA,
            minutes_after_start=20,
        )
        score = calculate_score(user, active_contest)
        assert score.penalty == 10

    def test_two_solved_problems(self, user, problem, problem2, active_contest):
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=10,
        )
        submit_at(
            user,
            problem2,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=20,
        )
        score = calculate_score(user, active_contest)
        assert score.score == 200
        assert score.solved_count == 2
        assert score.penalty == 30  # 10 + 20

    def test_unsolved_problem_no_penalty(self, user, problem, problem2, active_contest):
        # Only WA on problem2 — not solved, no penalty
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=10,
        )
        submit_at(
            user,
            problem2,
            active_contest,
            Submission.Verdict.WA,
            minutes_after_start=15,
        )
        score = calculate_score(user, active_contest)
        assert score.score == 100
        assert score.solved_count == 1
        assert score.penalty == 10  # only from problem1

    def test_score_updated_on_recalculation(
        self, user, problem, problem2, active_contest
    ):
        submit_at(
            user,
            problem,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=10,
        )
        score = calculate_score(user, active_contest)
        assert score.score == 100

        # Now solve problem2
        submit_at(
            user,
            problem2,
            active_contest,
            Submission.Verdict.AC,
            minutes_after_start=25,
        )
        score = calculate_score(user, active_contest)
        assert score.score == 200


# ---------------------------------------------------------------------------
# Leaderboard ordering tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLeaderboard:
    def test_higher_score_ranks_first(
        self, user, other, problem, problem2, active_contest
    ):
        # user solves both problems
        submit_at(user, problem, active_contest, Submission.Verdict.AC, 10)
        submit_at(user, problem2, active_contest, Submission.Verdict.AC, 20)
        calculate_score(user, active_contest)

        # other solves only one
        submit_at(other, problem, active_contest, Submission.Verdict.AC, 10)
        calculate_score(other, active_contest)

        lb = list(get_leaderboard(active_contest))
        assert lb[0].user == user
        assert lb[1].user == other

    def test_same_score_lower_penalty_ranks_first(
        self, user, other, problem, active_contest
    ):
        # user — AC at 10 min (penalty=10)
        submit_at(user, problem, active_contest, Submission.Verdict.AC, 10)
        calculate_score(user, active_contest)

        # other — WA then AC at 20 min (penalty=20+10=30)
        submit_at(other, problem, active_contest, Submission.Verdict.WA, 5)
        submit_at(other, problem, active_contest, Submission.Verdict.AC, 20)
        calculate_score(other, active_contest)

        lb = list(get_leaderboard(active_contest))
        assert lb[0].user == user  # lower penalty wins


# ---------------------------------------------------------------------------
# Leaderboard API tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLeaderboardAPI:
    def test_leaderboard_returns_200(self, api_client, user, active_contest):
        api_client.force_authenticate(user=user)
        url = reverse("contests-leaderboard", args=[active_contest.pk])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_leaderboard_contains_correct_fields(
        self, api_client, user, problem, active_contest
    ):
        api_client.force_authenticate(user=user)
        submit_at(user, problem, active_contest, Submission.Verdict.AC, 10)
        calculate_score(user, active_contest)

        url = reverse("contests-leaderboard", args=[active_contest.pk])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        entry = response.data["results"][0]
        assert "rank" in entry
        assert "username" in entry
        assert "score" in entry
        assert "penalty" in entry
        assert "solved_count" in entry
        assert "rating_delta" in entry

    def test_leaderboard_rank_starts_at_1(
        self, api_client, user, problem, active_contest
    ):
        api_client.force_authenticate(user=user)
        submit_at(user, problem, active_contest, Submission.Verdict.AC, 10)
        calculate_score(user, active_contest)

        url = reverse("contests-leaderboard", args=[active_contest.pk])
        response = api_client.get(url)
        assert response.data["results"][0]["rank"] == 1


# ---------------------------------------------------------------------------
# Submission -> score recalculation hook tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_score_recalculated_on_ac_transition(user, problem, active_contest):
    # Create a non-AC submission first, then transition to AC to trigger the hook.
    submission = Submission.objects.create(
        user=user,
        problem=problem,
        contest=active_contest,
        code="x=1",
        language=Submission.Language.PYTHON,
        verdict=Submission.Verdict.WA,
    )
    desired_created_at = active_contest.start_time + timedelta(minutes=10)
    Submission.objects.filter(pk=submission.pk).update(created_at=desired_created_at)

    submission.verdict = Submission.Verdict.AC
    submission.save(update_fields=["verdict"])

    score = ContestScore.objects.get(user=user, contest=active_contest)
    assert score.score == 100
    assert score.solved_count == 1


@pytest.mark.django_db
def test_contest_score_str_contains_fields(user, active_contest):
    score = ContestScore.objects.create(
        user=user,
        contest=active_contest,
        score=123,
        penalty=45,
        solved_count=2,
    )
    text = str(score)
    assert "score=123" in text
    assert "penalty=45" in text


# ---------------------------------------------------------------------------
# Leaderboard pagination + rating_delta tests
# ---------------------------------------------------------------------------


def _leaderboard_url(contest, page=None):
    url = reverse("contests-leaderboard", args=[contest.pk])
    return f"{url}?page={page}" if page else url


def fill_scores(contest, django_user_model, n):
    for i in range(n):
        participant = django_user_model.objects.create_user(
            username=f"p{i}", email=f"p{i}@test.com", password="pass"
        )
        ContestScore.objects.create(
            user=participant, contest=contest, score=100 * (n - i), penalty=i
        )


@pytest.mark.django_db
class TestLeaderboardPagination:
    def test_first_page_has_10_rows(
        self, api_client, user, active_contest, django_user_model
    ):
        fill_scores(active_contest, django_user_model, 12)
        api_client.force_authenticate(user=user)
        response = api_client.get(_leaderboard_url(active_contest))
        assert response.data["count"] == 12
        assert len(response.data["results"]) == 10
        assert response.data["next"] is not None

    def test_second_page_rank_continues(
        self, api_client, user, active_contest, django_user_model
    ):
        fill_scores(active_contest, django_user_model, 12)
        api_client.force_authenticate(user=user)
        response = api_client.get(_leaderboard_url(active_contest, page=2))
        assert [row["rank"] for row in response.data["results"]] == [11, 12]

    def test_full_tie_is_ordered_by_id(self, api_client, user, other, active_contest):
        ContestScore.objects.create(user=user, contest=active_contest)
        ContestScore.objects.create(user=other, contest=active_contest)
        api_client.force_authenticate(user=user)
        response = api_client.get(_leaderboard_url(active_contest))
        usernames = [row["username"] for row in response.data["results"]]
        assert usernames == [user.username, other.username]

    def test_rating_delta_in_response(self, api_client, user, active_contest):
        ContestScore.objects.create(
            user=user, contest=active_contest, score=100, rating_delta=48
        )
        api_client.force_authenticate(user=user)
        response = api_client.get(_leaderboard_url(active_contest))
        assert response.data["results"][0]["rating_delta"] == 48
