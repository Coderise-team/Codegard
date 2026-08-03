import logging

from apps.realtime.events import SubmissionEvents
from apps.submissions.models import Submission
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class SubmissionConsumer(AsyncJsonWebsocketConsumer):
    """Live verdict feed for a single submission.

    A client connects to ``ws/submissions/<id>/`` to watch one submission until
    the judge finishes. Access is restricted to the submission's owner — the
    socket is closed with 4001 (not authenticated), 4003 (not the owner), or
    4004 (no such submission). Once accepted, the consumer joins the
    ``submission_<id>`` group and relays every ``submission_update`` the signals
    broadcast; the current status is also sent immediately so a reconnect is
    never left blank.
    """

    async def connect(self):
        user = self.scope["user"]
        # accept() before close() on every rejection: until the handshake is
        # accepted Channels just refuses the connection and the browser sees a
        # generic 1006 — our 4001/4003/4004 codes would never reach the client.
        if not user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.submission_id = int(self.scope["url_route"]["kwargs"]["submission_id"])
        self.group_name = f"submission_{self.submission_id}"

        submission = await self.get_submission()
        if submission is None:
            await self.accept()
            await self.close(code=4004)
            return

        if submission.user_id != user.pk:
            await self.accept()
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current status immediately — handles reconnection gracefully
        await self.send_json(
            {
                "type": SubmissionEvents.SUBMISSION_UPDATE,
                "submission_id": submission.pk,
                "verdict": submission.verdict,
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # --- channel layer event handler ---

    async def submission_update(self, event):
        await self.send_json(
            {
                "type": SubmissionEvents.SUBMISSION_UPDATE,
                "submission_id": event["submission_id"],
                "verdict": event["verdict"],
            }
        )

    # --- DB helpers ---

    @database_sync_to_async
    def get_submission(self):
        try:
            return Submission.objects.get(pk=self.submission_id)
        except Submission.DoesNotExist:
            return None
