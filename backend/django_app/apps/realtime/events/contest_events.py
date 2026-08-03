"""
WebSocket event type constants for the contest channel.

Both events are payload-free signals: ``leaderboard_update`` means "standings
moved, refetch over HTTP" and ``contest_ended`` means "final results, ELO
included, are in". The socket never carries the rows themselves.

These string values double as Channels message ``type`` keys, which means they
also map to the handler method names on ContestConsumer (e.g. the value
``"leaderboard_update"`` is dispatched to ``ContestConsumer.leaderboard_update``).
Do not change the values without renaming the matching consumer methods and
updating the frontend.
"""


class ContestEvents:
    LEADERBOARD_UPDATE = "leaderboard_update"
    CONTEST_ENDED = "contest_ended"
