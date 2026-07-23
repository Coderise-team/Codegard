"""
Tests for WebSocket event constants.

These values are part of the contract with the frontend AND map to the Channels
consumer handler method names, so they are pinned here to catch accidental edits.
"""

from apps.realtime.consumers.contest import ContestConsumer
from apps.realtime.consumers.submission import SubmissionConsumer
from apps.realtime.events import ContestEvents, SubmissionEvents


def test_contest_event_values():
    assert ContestEvents.LEADERBOARD_UPDATE == "leaderboard_update"
    assert ContestEvents.CONTEST_ENDED == "contest_ended"
    assert ContestEvents.PROBLEM_SOLVED == "problem_solved"


def test_submission_event_values():
    assert SubmissionEvents.SUBMISSION_UPDATE == "submission_update"


def test_contest_events_map_to_consumer_handlers():
    """Each contest event value must have a matching handler method on the consumer."""
    for value in (
        ContestEvents.LEADERBOARD_UPDATE,
        ContestEvents.CONTEST_ENDED,
        ContestEvents.PROBLEM_SOLVED,
    ):
        assert hasattr(ContestConsumer, value), f"No handler for {value!r}"


def test_submission_events_map_to_consumer_handlers():
    assert hasattr(SubmissionConsumer, SubmissionEvents.SUBMISSION_UPDATE)


def test_no_duplicate_event_values():
    """Event values must be unique so Channels dispatch stays unambiguous."""
    values = [
        ContestEvents.LEADERBOARD_UPDATE,
        ContestEvents.CONTEST_ENDED,
        ContestEvents.PROBLEM_SOLVED,
        SubmissionEvents.SUBMISSION_UPDATE,
    ]
    assert len(values) == len(set(values))
