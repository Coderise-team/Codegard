from apps.realtime.events import NotificationEvents
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """The bell's doorbell — one socket per logged-in person, site-wide.

    A client connects to ``ws/notifications/`` and stays there for the whole
    session. The only thing that ever comes down this wire is a payload-free
    ``notification``: "there is something new for you". The client answers it by
    refetching the unread count (and the feed, if it happens to be open) over
    HTTP, which keeps one entity from having two sources of truth — the socket
    drops often enough that HTTP has to stay authoritative anyway.

    There is nothing to look up and nothing to be forbidden from: the group is
    ``user_<id>`` of whoever is connected, so the sibling consumers' 4003/4004
    cases cannot arise here. The only rejection is 4001 (not authenticated).

    Nothing is sent on connect — the page fetches its count over HTTP on load.
    """

    async def connect(self):
        user = self.scope["user"]
        # accept() before close() on rejection: until the handshake is accepted
        # Channels just refuses the connection and the browser sees a generic
        # 1006, so our 4001 would never reach the client.
        if not user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.group_name = f"user_{user.pk}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # --- channel layer event handler ---

    async def notification(self, event):
        # Signal only: the event type IS the whole message.
        await self.send_json({"type": NotificationEvents.NOTIFICATION})
