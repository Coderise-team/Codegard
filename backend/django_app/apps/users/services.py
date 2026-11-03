from typing import NamedTuple

from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

# ELO swing per contest. Plain in-code constant (a tuning knob, not env config).
K_FACTOR = 32

# Rank tiers by ELO, lower bound inclusive. Highest first for a simple lookup:
# e.g. elo 1200 -> Junior, 1399 -> Junior, 1400 -> Specialist, 2400+ -> Kernel.
RANK_THRESHOLDS = [
    (2400, "Kernel"),
    (2200, "Architect"),
    (2000, "Grandmaster"),
    (1800, "Master"),
    (1600, "Expert"),
    (1400, "Specialist"),
    (1200, "Junior"),
    (0, "Trainee"),
]


def get_rank(elo: int) -> str:
    """Map an ELO rating to its rank name (computed on the fly, never stored)."""
    for threshold, name in RANK_THRESHOLDS:
        if elo >= threshold:
            return name
    return "Trainee"  # fallback for unexpected negative ratings


class EloParticipant(NamedTuple):
    """One contestant for the pure ELO calc.

    place_key is (score, penalty, last_ac_at): higher score is better, then
    lower penalty, then earlier last_ac_at. last_ac_at may be None (submitted
    but solved nothing) — treated as the worst/latest.
    """

    user_id: int
    rating: int
    place_key: tuple


def _ranks_above(key_a: tuple, key_b: tuple) -> bool:
    """True if place key a is strictly better (finishes above) b."""
    score_a, penalty_a, ac_a = key_a
    score_b, penalty_b, ac_b = key_b
    if score_a != score_b:
        return score_a > score_b  # more points is better
    if penalty_a != penalty_b:
        return penalty_a < penalty_b  # less penalty is better
    # Same score & penalty → earlier last_ac_at wins; None counts as latest.
    if ac_a == ac_b:
        return False
    if ac_a is None:
        return False
    if ac_b is None:
        return True
    return ac_a < ac_b


def compute_elo_deltas(participants: list[EloParticipant]) -> dict[int, int]:
    """
    Pure, DB-free multiplayer ELO. Each contestant is treated as having played
    a mini-duel against every other; the summed change is normalised by the
    number of opponents (N-1) so |delta| <= K_FACTOR regardless of field size.

    Args:
        participants: contestants (order doesn't affect correctness — beat/draw
            is decided by place_key, not list position).

    Returns:
        {user_id: delta}. Empty when fewer than 2 participants (no opponents).
    """
    n = len(participants)
    if n < 2:
        return {}

    deltas: dict[int, int] = {}
    for i, p in enumerate(participants):
        expected = 0.0
        actual = 0.0
        for j, opp in enumerate(participants):
            if i == j:
                continue
            expected += 1 / (1 + 10 ** ((opp.rating - p.rating) / 400))
            if p.place_key == opp.place_key:
                actual += 0.5  # draw
            elif _ranks_above(p.place_key, opp.place_key):
                actual += 1.0  # beat them

        deltas[p.user_id] = round(K_FACTOR * (actual - expected) / (n - 1))

    return deltas


def revoke_refresh_tokens(user) -> None:
    """Blacklist every outstanding refresh token of ``user``.

    Ends all of the user's sessions at once: no device can mint a new access
    token after this. An access token already issued keeps working until it
    expires (minutes), which is how JWT works and why its lifetime is short.

    A caller that keeps the user signed in must mint the new pair AFTER this
    call, or the fresh refresh token is revoked along with the rest.
    get_or_create skips tokens that are already blacklisted.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
