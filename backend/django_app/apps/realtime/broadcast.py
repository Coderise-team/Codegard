"""Single entry point for pushing a message into a channel group.

Every producer (submission signals, contest tasks) used to repeat the same
three lines: fetch the channel layer, guard against it being unconfigured, then
``group_send``. Keeping it here means the lazy ``asgiref``/``channels`` imports
and the None-guard live in exactly one place.
"""


def group_send(group: str, message: dict) -> None:
    """Send ``message`` to every consumer in ``group``.

    No-op when the channel layer isn't configured (e.g. plain unit tests), so
    callers never have to care whether realtime is wired up.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(group, message)
