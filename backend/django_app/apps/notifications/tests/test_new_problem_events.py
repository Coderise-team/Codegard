"""Notifications for problems entering the public catalog.

A problem becomes visible along two paths — an admin unhides one, or the batch
task opens a finished contest's set — and the awkward part is that the second
path is a bulk UPDATE, which fires no signals at all. Both are covered here,
together with the two rules that matter most: a hidden problem is never
announced under any circumstances, and the people who just played the contest
get one summary line rather than one line per problem they were solving all
afternoon.
"""

from unittest.mock import patch

import pytest
from apps.contests.tasks import publish_finished_contest_problems
from apps.notifications.models import Notification
from apps.problems.models import Problem
from factories import make_contest, make_problem, make_user


def new_problem_for(user):
    return Notification.objects.filter(user=user, type=Notification.Type.NEW_PROBLEM)


@pytest.fixture
def member(db):
    return make_user("member", 1200)


# --- the admin path (signal) -----------------------------------------------


@pytest.mark.django_db
def test_a_published_problem_is_announced(member):
    problem = make_problem("Two Sum", is_hidden=False)

    notification = new_problem_for(member).get()
    assert notification.title == "New problem"
    assert notification.body == "Two Sum is now available"
    assert notification.link == f"/problems/{problem.pk}"


@pytest.mark.django_db
def test_a_hidden_problem_is_never_announced(member):
    """The statement leak this guard exists for: an unreleased contest problem
    must not be advertised before its round."""
    make_problem("Secret", is_hidden=True)

    assert not new_problem_for(member).exists()


@pytest.mark.django_db
def test_unhiding_a_problem_announces_it(member):
    problem = make_problem("Later", is_hidden=True)
    assert not new_problem_for(member).exists()

    problem.is_hidden = False
    problem.save()

    assert new_problem_for(member).count() == 1


@pytest.mark.django_db
def test_editing_a_public_problem_announces_nothing_new(member):
    """Announcing on every save, not on the transition, would mean a typo fix
    delivers a month-old problem to everyone who joined in the meantime."""
    problem = make_problem("Two Sum", is_hidden=False)
    latecomer = make_user("latecomer", 1200)

    problem.title = "Two Sum (fixed)"
    problem.save()

    assert new_problem_for(member).count() == 1
    assert not new_problem_for(latecomer).exists()


@pytest.mark.django_db
def test_a_deactivated_account_hears_nothing(db):
    disabled = make_user("disabled", 1200, is_active=False)

    make_problem("Two Sum", is_hidden=False)

    assert not new_problem_for(disabled).exists()


@pytest.mark.django_db
def test_publishing_with_nobody_around_does_not_break(db):
    make_problem("Two Sum", is_hidden=False)  # should not raise

    assert Notification.objects.count() == 0


# --- the batch path (task) -------------------------------------------------


@pytest.fixture
def finished_round(db):
    """A contest that is over, with two problems still hidden."""
    contest = make_contest("Round 1", starts_in=-3, ends_in=-1)
    first = make_problem("Alpha", is_hidden=True)
    second = make_problem("Beta", is_hidden=True)
    contest.problems.add(first, second)
    return contest, first, second


@pytest.mark.django_db
def test_the_batch_task_announces_what_it_reveals(finished_round, member):
    """A bulk UPDATE fires no signals, so the task must announce for itself."""
    _, first, second = finished_round

    publish_finished_contest_problems()

    first.refresh_from_db()
    assert first.is_hidden is False  # the task did its own job too
    bodies = set(new_problem_for(member).values_list("body", flat=True))
    assert bodies == {"Alpha is now available", "Beta is now available"}


@pytest.mark.django_db
def test_an_entrant_gets_one_summary_instead_of_a_pile(finished_round):
    """Otherwise the minute a round ends they get "finished", a rating, a rank,
    and then one note per problem they just spent the afternoon on."""
    contest, _, _ = finished_round
    entrant = make_user("entrant", 1200)
    contest.participants.add(entrant)

    publish_finished_contest_problems()

    notification = new_problem_for(entrant).get()  # exactly one, not two
    assert notification.title == "Contest problems published"
    assert notification.body == "Problems from Round 1 are now in the catalog"
    assert notification.link == f"/contests/{contest.pk}"


@pytest.mark.django_db
def test_everyone_else_still_hears_about_each_problem(finished_round):
    contest, _, _ = finished_round
    entrant = make_user("entrant", 1200)
    outsider = make_user("outsider", 1200)
    contest.participants.add(entrant)

    publish_finished_contest_problems()

    assert new_problem_for(entrant).count() == 1  # the summary
    assert new_problem_for(outsider).count() == 2  # one per problem


@pytest.mark.django_db
def test_a_contest_still_running_keeps_its_problems_quiet(db, member):
    running = make_contest("Live", starts_in=-1, ends_in=1)
    running.problems.add(make_problem("Alpha", is_hidden=True))

    publish_finished_contest_problems()

    assert not new_problem_for(member).exists()


# --- the two paths do not double up ----------------------------------------


@pytest.mark.django_db
def test_a_re_saved_problem_is_not_announced_twice(finished_round, member):
    """Both paths key on problem_<id>_new, so the batch and a later admin save
    cannot deliver the same problem twice."""
    _, first, _ = finished_round
    publish_finished_contest_problems()
    before = new_problem_for(member).count()

    first.refresh_from_db()
    first.title = "Alpha (fixed)"
    first.save()

    assert new_problem_for(member).count() == before


@pytest.mark.django_db
def test_running_the_batch_again_announces_nothing(finished_round, member):
    publish_finished_contest_problems()
    before = Notification.objects.count()

    publish_finished_contest_problems()

    assert Notification.objects.count() == before


# --- the doorbell ----------------------------------------------------------


@pytest.mark.django_db
def test_a_batch_of_problems_rings_each_person_once(
    finished_round, django_capture_on_commit_callbacks
):
    """Two problems revealed at once is still one signal per person."""
    contest, _, _ = finished_round
    entrant = make_user("entrant", 1200)
    outsider = make_user("outsider", 1200)
    contest.participants.add(entrant)

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            publish_finished_contest_problems()

    rung = [call.args[0] for call in ring.call_args_list]
    assert sorted(rung) == sorted([entrant.pk, outsider.pk])


@pytest.mark.django_db
def test_a_hidden_problem_rings_nobody(member, django_capture_on_commit_callbacks):
    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            Problem.objects.create(title="Secret", description="", is_hidden=True)

    ring.assert_not_called()
