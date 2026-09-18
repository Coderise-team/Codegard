"""Notifications emitted when a contest's ELO is applied.

Source: ``contests.services.apply_contest_ratings``. Two events are born there
— ``rating_changed`` for everyone whose rating actually moved, and
``rank_changed`` for the few who crossed a tier boundary — and the doorbell is
rung once per person no matter how many of the two they got.

The ELO here is deliberately arranged rather than approximated: with two
equally-rated contestants the delta is exactly +/-16, so the ratings below sit
one point either side of the 1400 (Specialist) threshold to force a promotion,
a demotion, or neither on demand.
"""

from unittest.mock import patch

import pytest
from apps.contests.services import apply_contest_ratings
from apps.notifications.models import Notification
from apps.submissions.models import Submission
from factories import make_contest, make_problem, make_submission, make_user


@pytest.fixture
def contest(db):
    """A contest that has already ended, with one problem attached."""
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    contest.problems.add(make_problem("Two Sum"))
    return contest


def play(contest, winner_elo, loser_elo):
    """One decided round: `winner` solves the problem, `loser` does not.

    Equal ratings make the maths trivial — the winner gains exactly 16 and the
    loser drops exactly 16.
    """
    problem = contest.problems.first()
    winner = make_user("winner", winner_elo)
    loser = make_user("loser", loser_elo)
    make_submission(winner, problem, contest, Submission.Verdict.AC)
    make_submission(loser, problem, contest, Submission.Verdict.WA)
    return winner, loser


def notifications_for(user, type):
    return Notification.objects.filter(user=user, type=type)


# --- rating_changed --------------------------------------------------------


@pytest.mark.django_db
def test_both_contestants_are_told_what_their_rating_did(contest):
    winner, loser = play(contest, 1200, 1200)

    apply_contest_ratings(contest)

    gained = notifications_for(winner, Notification.Type.RATING_CHANGED).get()
    lost = notifications_for(loser, Notification.Type.RATING_CHANGED).get()
    assert gained.title == "Rating changed"
    assert gained.body == "+16 → 1216"  # the sign is part of the news
    assert lost.body == "-16 → 1184"


@pytest.mark.django_db
def test_the_rating_notification_leads_to_the_profile(contest):
    winner, _ = play(contest, 1200, 1200)

    apply_contest_ratings(contest)

    notification = notifications_for(winner, Notification.Type.RATING_CHANGED).get()
    assert notification.link == f"/users/{winner.username}"


@pytest.mark.django_db
def test_a_rating_that_did_not_move_is_not_announced(contest):
    """Two contestants who both solved nothing draw, and a draw between equals
    is a delta of exactly zero — there is no news to deliver."""
    problem = contest.problems.first()
    a = make_user("a", 1200)
    b = make_user("b", 1200)
    make_submission(a, problem, contest, Submission.Verdict.WA)
    make_submission(b, problem, contest, Submission.Verdict.WA)

    apply_contest_ratings(contest)

    a.refresh_from_db()
    assert a.elo_rating == 1200  # the premise: nothing moved
    assert Notification.objects.count() == 0


# --- rank_changed ----------------------------------------------------------


@pytest.mark.django_db
def test_crossing_a_tier_upwards_is_announced_as_a_new_rank(contest):
    """1399 + 16 = 1415: Junior becomes Specialist."""
    winner, _ = play(contest, 1399, 1399)

    apply_contest_ratings(contest)

    notification = notifications_for(winner, Notification.Type.RANK_CHANGED).get()
    assert notification.title == "New rank"
    assert notification.body == "You reached Specialist"
    assert notification.link == f"/users/{winner.username}"


@pytest.mark.django_db
def test_falling_out_of_a_tier_is_announced_too(contest):
    """1400 - 16 = 1384: Specialist drops back to Junior."""
    _, loser = play(contest, 1400, 1400)

    apply_contest_ratings(contest)

    notification = notifications_for(loser, Notification.Type.RANK_CHANGED).get()
    assert notification.title == "Rank changed"
    assert notification.body == "You dropped to Junior"


@pytest.mark.django_db
def test_staying_inside_a_tier_says_nothing_about_rank(contest):
    """1399 - 16 = 1383: still Junior, so only the rating is news."""
    _, loser = play(contest, 1399, 1399)

    apply_contest_ratings(contest)

    assert not notifications_for(loser, Notification.Type.RANK_CHANGED).exists()
    assert notifications_for(loser, Notification.Type.RATING_CHANGED).exists()


# --- dedup -----------------------------------------------------------------


@pytest.mark.django_db
def test_re_rating_the_same_contest_does_not_duplicate(contest):
    """Belt and braces behind ``rating_applied``: even if the flag is cleared
    and the contest is rated again, the keys refuse a second copy."""
    winner, _ = play(contest, 1399, 1399)
    apply_contest_ratings(contest)
    before = Notification.objects.count()

    contest.rating_applied = False
    contest.save(update_fields=["rating_applied"])
    apply_contest_ratings(contest)

    assert Notification.objects.count() == before


# --- the doorbell ----------------------------------------------------------


@pytest.mark.django_db
def test_a_person_is_rung_once_even_with_two_notifications(
    contest, django_capture_on_commit_callbacks
):
    """The promoted winner gets rating_changed AND rank_changed — one ring."""
    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            winner, loser = play(contest, 1399, 1399)
            apply_contest_ratings(contest)

    assert notifications_for(winner, Notification.Type.RATING_CHANGED).exists()
    assert notifications_for(winner, Notification.Type.RANK_CHANGED).exists()
    rung = [call.args[0] for call in ring.call_args_list]
    assert sorted(rung) == sorted([winner.pk, loser.pk])  # once each, nobody twice


@pytest.mark.django_db
def test_nobody_is_rung_when_there_was_no_news(
    contest, django_capture_on_commit_callbacks
):
    problem = contest.problems.first()
    a = make_user("a", 1200)
    b = make_user("b", 1200)

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            make_submission(a, problem, contest, Submission.Verdict.WA)
            make_submission(b, problem, contest, Submission.Verdict.WA)
            apply_contest_ratings(contest)

    ring.assert_not_called()


@pytest.mark.django_db
def test_an_unrated_contest_notifies_nobody(
    contest, django_capture_on_commit_callbacks
):
    """A single entrant has no opponents, so nothing is rated and nothing said."""
    problem = contest.problems.first()
    alone = make_user("alone", 1200)

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            make_submission(alone, problem, contest, Submission.Verdict.AC)
            apply_contest_ratings(contest)

    assert Notification.objects.count() == 0
    ring.assert_not_called()
