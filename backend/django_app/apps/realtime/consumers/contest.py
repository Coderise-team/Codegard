import logging

from apps.contests.models import Contest
from apps.realtime.events import ContestEvents
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

logger = logging.getLogger(__name__)


class ContestConsumer(AsyncJsonWebsocketConsumer):
    """Change notifier for a single contest — it signals, it does not carry data.

    A participant connects to ``ws/contests/<id>/`` to learn *when* the
    standings changed; the rows themselves are fetched over the paginated HTTP
    endpoint. Access requires an authenticated participant — the socket closes
    with 4001 (not authenticated), 4003 (not a participant), or 4004 (no such
    contest).

    Once accepted the consumer joins the ``contest_<id>`` group and relays two
    payload-free events: ``leaderboard_update`` (something changed, refetch) and
    ``contest_ended`` (final results, including ELO, are in). Nothing is pushed
    on connect — the page loads its data over HTTP anyway.
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

        # Opening an old contest whose results are final: say so and close.
        # Anything short of "rated" keeps the socket open, waiting for the event.
        if await self.is_contest_rated(contest.pk):
            await self.send_json({"type": ContestEvents.CONTEST_ENDED})
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # --- channel layer event handlers ---

    async def leaderboard_update(self, event):
        # Signal only: the event type IS the whole message.
        await self.send_json({"type": ContestEvents.LEADERBOARD_UPDATE})

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
    def is_contest_rated(self, contest_id: int) -> bool:
        """Contest is over AND its ELO has been applied.

        Checked against the clock, not the cached ``status`` field: this
        consumer no longer refreshes the status on connect, so the column can
        lag by up to a beat interval. ``end_time`` is the source of truth.
        """
        return Contest.objects.filter(
            pk=contest_id,
            end_time__lt=timezone.now(),
            rating_applied=True,
        ).exists()
