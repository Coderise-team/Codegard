"""
WebSocket event type constant for the per-user notification channel.

The bell is a doorbell: this event carries no payload at all. It means "there
is something new for you" and nothing else — the client answers it by refetching
the unread count (and the feed, if it happens to be open) over HTTP. Carrying
the notification itself would give one entity two sources of truth, and the
socket drops often enough that HTTP has to stay authoritative anyway.

The string value doubles as the Channels message ``type`` key, so it also maps
to the handler method name on NotificationConsumer (``"notification"`` is
dispatched to ``NotificationConsumer.notification``). Do not change the value
without renaming that method and updating the frontend.
"""


class NotificationEvents:
    NOTIFICATION = "notification"
