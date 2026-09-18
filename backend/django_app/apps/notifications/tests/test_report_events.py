"""Notifications for a problem report being judged.

Source: the ``ProblemReport`` signals. The verdict is the point of the message,
so it is spelled out in the body, and the problem's title always comes from the
report's own snapshot — a report outlives the problem it was about, and the
text has to keep reading sensibly after the problem is deleted.
"""

from unittest.mock import patch

import pytest
from apps.notifications.models import Notification
from apps.problems.models import ProblemReport
from factories import make_problem, make_user


@pytest.fixture
def report(db, user):
    problem = make_problem("Two Sum", is_hidden=False)
    return ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=user,
        reason=ProblemReport.Reason.WRONG_TEST,
        message="Something is off with the tests.",
    )


def resolved_for(user):
    return Notification.objects.filter(
        user=user, type=Notification.Type.REPORT_RESOLVED
    )


def review(report, status):
    report.status = status
    report.save()


# --- the verdict reaches the author ----------------------------------------


@pytest.mark.django_db
def test_an_accepted_report_is_reported_back(report, user):
    review(report, ProblemReport.Status.ACCEPTED)

    notification = resolved_for(user).get()
    assert notification.title == "Report reviewed"
    assert notification.body == "Your report on Two Sum was accepted"
    assert notification.link == f"/problems/{report.problem_id}"


@pytest.mark.django_db
def test_a_rejected_report_says_so(report, user):
    """The outcome is the whole news — it cannot be left to the title."""
    review(report, ProblemReport.Status.REJECTED)

    assert resolved_for(user).get().body == "Your report on Two Sum was rejected"


@pytest.mark.django_db
def test_nobody_else_is_told(report, other):
    review(report, ProblemReport.Status.ACCEPTED)

    assert not resolved_for(other).exists()


# --- only the transition out of `new` counts -------------------------------


@pytest.mark.django_db
def test_filing_a_report_announces_nothing(report, user):
    assert report.status == ProblemReport.Status.NEW
    assert not resolved_for(user).exists()


@pytest.mark.django_db
def test_a_report_saved_again_while_pending_stays_quiet(report, user):
    report.message = "Rewritten while still pending."
    report.save()

    assert not resolved_for(user).exists()


@pytest.mark.django_db
def test_re_saving_a_judged_report_does_not_tell_them_twice(report, user):
    review(report, ProblemReport.Status.ACCEPTED)

    report.resolved_by = make_user("staff", 1200, is_staff=True)
    report.save()

    assert resolved_for(user).count() == 1


# --- the rows that outlive what they point at ------------------------------


@pytest.mark.django_db
def test_a_report_whose_author_is_gone_is_skipped(report):
    """``user`` is SET_NULL: the report survives the account. There is nobody
    to tell, and that is not an error."""
    report.user.delete()
    report.refresh_from_db()
    assert report.user_id is None

    review(report, ProblemReport.Status.ACCEPTED)  # must not raise

    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_a_deleted_problem_leaves_the_row_unclickable_but_readable(report, user):
    """``problem`` is SET_NULL too. The link has nowhere to go, but the
    snapshot keeps the text meaningful."""
    report.problem.delete()
    report.refresh_from_db()
    assert report.problem_id is None

    review(report, ProblemReport.Status.ACCEPTED)

    notification = resolved_for(user).get()
    assert notification.link == ""
    assert notification.body == "Your report on Two Sum was accepted"


@pytest.mark.django_db
def test_a_renamed_problem_keeps_the_title_the_reporter_used(report, user):
    """The snapshot is what they filed against, not what it is called now."""
    report.problem.title = "Two Sum II"
    report.problem.save()

    review(report, ProblemReport.Status.ACCEPTED)

    assert resolved_for(user).get().body == "Your report on Two Sum was accepted"


# --- the doorbell ----------------------------------------------------------


@pytest.mark.django_db
def test_the_author_is_rung_once(report, user, django_capture_on_commit_callbacks):
    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            review(report, ProblemReport.Status.ACCEPTED)

    ring.assert_called_once_with(user.pk)


@pytest.mark.django_db
def test_a_pending_report_rings_nobody(report, django_capture_on_commit_callbacks):
    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            report.message = "Still pending, just edited."
            report.save()

    ring.assert_not_called()


# --- the function's own contract -------------------------------------------


@pytest.mark.django_db
def test_announcing_a_pending_report_directly_is_a_no_op(report, user):
    """The signal never offers a pending report, but the function does not
    depend on that: with no verdict there is nothing to announce."""
    from apps.problems.notifications import announce_report_resolved

    announce_report_resolved(report)  # status is still `new`

    assert not resolved_for(user).exists()


# --- the bulk actions in the report queue ----------------------------------

QUEUE_URL = "/admin/problems/problemreport/"


def file_report(problem, author, reason=ProblemReport.Reason.WRONG_TEST):
    return ProblemReport.objects.create(
        problem=problem,
        problem_title=problem.title,
        user=author,
        reason=reason,
        message="Something is off with the tests.",
    )


def run_action(admin_client, action, reports):
    return admin_client.post(
        QUEUE_URL,
        {"action": action, "_selected_action": [str(r.pk) for r in reports]},
        follow=True,
    )


@pytest.mark.django_db
def test_accepting_reports_in_bulk_tells_every_author(admin_client):
    """Resolving from the queue list used to be a bulk UPDATE that skipped the
    signals, so the authors never heard back — unlike the same change made in a
    report's own form."""
    problem = make_problem("Two Sum", is_hidden=False)
    first = make_user("first", 1200)
    second = make_user("second", 1200)
    reports = [file_report(problem, first), file_report(problem, second)]

    run_action(admin_client, "accept_reports", reports)

    for author in (first, second):
        assert resolved_for(author).get().body == "Your report on Two Sum was accepted"


@pytest.mark.django_db
def test_rejecting_reports_in_bulk_tells_every_author(admin_client):
    problem = make_problem("Two Sum", is_hidden=False)
    author = make_user("author", 1200)

    run_action(admin_client, "reject_reports", [file_report(problem, author)])

    assert resolved_for(author).get().body == "Your report on Two Sum was rejected"


@pytest.mark.django_db
def test_the_bulk_action_still_records_who_resolved_it(admin_client):
    """The switch from one UPDATE to a save per report keeps what the action
    already did: the resolver and the time are stamped on each report."""
    problem = make_problem("Two Sum", is_hidden=False)
    report = file_report(problem, make_user("author", 1200))

    run_action(admin_client, "accept_reports", [report])

    report.refresh_from_db()
    assert report.status == ProblemReport.Status.ACCEPTED
    assert report.resolved_by.is_superuser  # the admin who ran the action
    assert report.resolved_at is not None


@pytest.mark.django_db
def test_a_bulk_action_follows_the_same_rule_as_the_form(admin_client):
    """Only a report leaving `new` is announced. Flipping an already-resolved
    report the other way is not a fresh review, from the list or from the form."""
    problem = make_problem("Two Sum", is_hidden=False)
    author = make_user("author", 1200)
    report = file_report(problem, author)
    run_action(admin_client, "accept_reports", [report])

    run_action(admin_client, "reject_reports", [report])

    assert resolved_for(author).count() == 1  # the accept, nothing for the flip


@pytest.mark.django_db
def test_reports_already_in_that_status_are_left_alone(admin_client):
    problem = make_problem("Two Sum", is_hidden=False)
    author = make_user("author", 1200)
    report = file_report(problem, author)
    run_action(admin_client, "accept_reports", [report])

    response = run_action(admin_client, "accept_reports", [report])

    assert "0 report(s) accepted." in response.content.decode()
    assert resolved_for(author).count() == 1


@pytest.mark.django_db
def test_a_bulk_action_rings_each_author_after_commit(
    admin_client, django_capture_on_commit_callbacks
):
    problem = make_problem("Two Sum", is_hidden=False)
    first = make_user("first", 1200)
    second = make_user("second", 1200)
    reports = [file_report(problem, first), file_report(problem, second)]

    with patch("apps.notifications.services.notify_user") as ring:
        with django_capture_on_commit_callbacks(execute=True):
            run_action(admin_client, "accept_reports", reports)

    assert sorted(c.args[0] for c in ring.call_args_list) == sorted(
        [first.pk, second.pk]
    )
