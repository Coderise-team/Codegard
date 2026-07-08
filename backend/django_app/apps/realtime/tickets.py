"""One-time WebSocket authentication tickets.

A browser ``WebSocket`` cannot send an ``Authorization`` header, and putting the
JWT in the URL would leak it into logs and history. Instead the frontend calls
``POST /api/ws-ticket/`` (authenticated over HTTP with its JWT) to mint a short
lived, single-use ticket, then opens ``ws://.../?ticket=<value>``. The ticket —
not the JWT — is all that ever appears in the URL.

The ticket store is the Django cache (Redis in dev/prod), so a ticket minted by
the HTTP worker is redeemable by whichever process handles the WebSocket.
"""

import secrets

from django.core.cache import cache

# Ticket lifetime. Short by design: it only needs to survive the round-trip
# between minting it and opening the socket.
WS_TICKET_TTL_SECONDS = 30

_KEY_PREFIX = "ws:ticket:"


def _key(ticket: str) -> str:
    return f"{_KEY_PREFIX}{ticket}"


def issue_ticket(user_id: int) -> str:
    """Mint a fresh single-use ticket for ``user_id`` and store it in the cache."""
    ticket = secrets.token_urlsafe(32)
    cache.set(_key(ticket), user_id, WS_TICKET_TTL_SECONDS)
    return ticket


def redeem_ticket(ticket: str | None) -> int | None:
    """Return the user id for a valid ticket, or ``None``.

    Redeeming deletes the ticket so it can't be reused. A missing, unknown, or
    expired ticket yields ``None`` — the caller falls back to an anonymous user.
    """
    if not ticket:
        return None
    key = _key(ticket)
    user_id = cache.get(key)
    if user_id is None:
        return None
    cache.delete(key)  # single-use: gone after the first redemption
    return user_id
