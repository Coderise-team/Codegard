"""Pure ELO formula tests (no DB) for compute_elo_deltas."""

from datetime import datetime, timezone

from apps.users.services import (
    K_FACTOR,
    EloParticipant,
    _ranks_above,
    compute_elo_deltas,
)

_T1 = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
_T2 = datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)


def test_ranks_above_score_then_penalty_then_time_and_none():
    # higher score wins
    assert _ranks_above((200, 99, _T2), (100, 0, _T1)) is True
    # equal score → lower penalty wins
    assert _ranks_above((100, 5, _T2), (100, 9, _T1)) is True
    assert _ranks_above((100, 9, _T2), (100, 5, _T1)) is False
    # equal score & penalty → earlier last_ac_at wins
    assert _ranks_above((100, 5, _T1), (100, 5, _T2)) is True
    # identical key → not "above" (it's a draw)
    assert _ranks_above((100, 5, _T1), (100, 5, _T1)) is False
    # None (solved nothing) counts as worst
    assert _ranks_above((0, 0, None), (0, 0, _T1)) is False  # a has None → not above
    assert _ranks_above((0, 0, _T1), (0, 0, None)) is True  # b has None → a above


def _p(user_id, rating, score, penalty=0, last_ac_at=None):
    return EloParticipant(user_id, rating, (score, penalty, last_ac_at))


def test_equal_ratings_two_players_symmetric():
    # p1 beats p2, equal ratings → +16 / -16 (K * 0.5 / 1).
    deltas = compute_elo_deltas([_p(1, 1200, 100), _p(2, 1200, 0)])
    assert deltas[1] == 16
    assert deltas[2] == -16
    assert deltas[1] == -deltas[2]


def test_swing_bounded_by_k_two_players():
    deltas = compute_elo_deltas([_p(1, 1200, 100), _p(2, 1200, 0)])
    assert all(abs(d) <= K_FACTOR for d in deltas.values())


def test_swing_bounded_by_k_large_field():
    # 10 players, distinct scores (distinct ranks), all equal rating.
    field = [_p(i, 1200, score=100 - i) for i in range(10)]
    deltas = compute_elo_deltas(field)
    assert len(deltas) == 10
    assert all(abs(d) <= K_FACTOR for d in deltas.values())


def test_upset_beats_higher_gives_more_than_equal_pair():
    # Lower-rated (1000) beats higher-rated (1400).
    deltas = compute_elo_deltas([_p(1, 1000, 100), _p(2, 1400, 0)])
    equal_pair_win = 16  # from the symmetric case
    assert deltas[1] > equal_pair_win  # upset winner gains more


def test_draw_gives_half_and_zero_delta_at_equal_ratings():
    # Identical place key → draw; equal ratings → ~0 for both.
    deltas = compute_elo_deltas(
        [_p(1, 1200, 100, penalty=5), _p(2, 1200, 100, penalty=5)]
    )
    assert deltas[1] == 0
    assert deltas[2] == 0


def test_fewer_than_two_returns_empty():
    assert compute_elo_deltas([]) == {}
    assert compute_elo_deltas([_p(1, 1200, 100)]) == {}
