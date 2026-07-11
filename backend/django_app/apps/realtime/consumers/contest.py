import logging

from apps.contests.models import Contest
from apps.contests.serializers import LeaderboardEntrySerializer
from apps.contests.services import get_leaderboard
from apps.realtime.events import ContestEvents
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class ContestConsumer(AsyncJsonWebsocketConsumer):
    """Live leaderboard + activity feed for a single contest.

    A participant connects to ``ws/contests/<id>/`` to follow the standings in
    real time. Access requires an authenticated participant — the socket closes
    with 4001 (not authenticated), 4003 (not a participant), or 4004 (no such
    contest). Once accepted the consumer joins the ``contest_<id>`` group and
    relays ``leaderboard_update`` / ``problem_solved`` / ``contest_ended``
    events; the current leaderboard is pushed immediately, and if the contest
    has already ended it sends ``contest_ended`` and closes.
    """

    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.contest_id = int(self.scope["url_route"]["kwargs"]["contest_id"])
        self.group_name = f"contest_{self.contest_id}"

        contest = await self.get_contest()
        if contest is None:
            await self.accept()
            await self.close(code=4004)
            return

        is_participant = await self.is_participant(user, contest.pk)
        if not is_participant:
            await self.accept()
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.refresh_contest_status(contest.pk)

        # Send current leaderboard immediately on connect
        leaderboard = await self.build_leaderboard(contest)
        await self.send_json(
            {"type": ContestEvents.LEADERBOARD_UPDATE, "leaderboard": leaderboard}
        )

        # If the contest has already ended, notify and close.
        ended = await self.is_contest_finished(contest.pk)
        if ended:
            await self.send_json({"type": ContestEvents.CONTEST_ENDED})
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # --- channel layer event handlers ---

    async def leaderboard_update(self, event):
        await self.send_json(
            {
                "type": ContestEvents.LEADERBOARD_UPDATE,
                "leaderboard": event["leaderboard"],
            }
        )

    async def problem_solved(self, event):
        await self.send_json(
            {
                "type": ContestEvents.PROBLEM_SOLVED,
                "username": event["username"],
                "problem_title": event["problem_title"],
            }
        )

    async def contest_ended(self, event):
        await self.send_json({"type": ContestEvents.CONTEST_ENDED})
        await self.close()

    # --- DB helpers ---

    @database_sync_to_async
    def get_contest(self):
        try:
            return Contest.objects.get(pk=self.contest_id)
        except Contest.DoesNotExist:
            return None

    @database_sync_to_async
    def is_participant(self, user, contest_id: int) -> bool:
        return Contest.objects.filter(pk=contest_id, participants=user).exists()

    @database_sync_to_async
    def refresh_contest_status(self, contest_id: int) -> None:
        contest = Contest.objects.get(pk=contest_id)
        contest.update_status()

    @database_sync_to_async
    def is_contest_finished(self, contest_id: int) -> bool:
        return Contest.objects.filter(
            pk=contest_id, status=Contest.Status.FINISHED
        ).exists()

    @database_sync_to_async
    def build_leaderboard(self, contest):
        entries = list(get_leaderboard(contest))
        for rank, entry in enumerate(entries, start=1):
            entry.rank = rank
        return list(LeaderboardEntrySerializer(entries, many=True).data)
