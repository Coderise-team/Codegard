import asyncio
import os
import socket
from unittest.mock import AsyncMock, patch

import pytest
from schemas.request import LanguageEnum, SubmissionRequest
from schemas.response import SubmissionResponse, VerdictEnum

from app import config
from app.config import get_settings, worker_identity
from app.worker import (
    announce,
    handle_one,
    maintenance_loop,
    recover_orphans,
    withdraw,
)

VALID_RAW = SubmissionRequest(
    submission_id=1,
    language=LanguageEnum.PYTHON,
    code="print(1)",
    time_limit_ms=1000,
    memory_limit_mb=128,
    test_cases=[],
).model_dump_json()


def _redis():
    r = AsyncMock()
    r.incr.return_value = 1
    return r


@patch("app.worker.run_submission")
async def test_success_pushes_result_and_clears_processing(mock_run):
    mock_run.return_value = SubmissionResponse(submission_id=1, verdict=VerdictEnum.AC)
    redis = _redis()

    await handle_one(redis, VALID_RAW)

    redis.rpush.assert_awaited_once()
    assert "judge:results" in redis.rpush.await_args.args[0]
    redis.lrem.assert_awaited_once()


@patch("app.worker.run_submission")
async def test_malformed_payload_dead_letters_and_does_not_run(mock_run):
    redis = _redis()

    await handle_one(redis, "{not json")

    mock_run.assert_not_called()
    pushed_keys = [c.args[0] for c in redis.rpush.await_args_list]
    assert any("judge:dead" in k for k in pushed_keys)
    assert all("judge:results" not in k for k in pushed_keys)


@patch("app.worker.run_submission", side_effect=RuntimeError("docker boom"))
async def test_run_failure_yields_terminal_result(mock_run):
    redis = _redis()

    await handle_one(redis, VALID_RAW)

    assert any("judge:results" in c.args[0] for c in redis.rpush.await_args_list)
    redis.lrem.assert_awaited()


@patch("app.worker.run_submission")
async def test_poison_pill_dead_letters_after_max_attempts(mock_run):
    redis = _redis()
    redis.incr.return_value = 99

    await handle_one(redis, VALID_RAW)

    mock_run.assert_not_called()
    assert any("judge:dead" in c.args[0] for c in redis.rpush.await_args_list)


def _redis_holding(*processing_keys, answering=()):
    """A Redis whose scan finds these in-flight lists, owned by these workers.

    Only the workers named in `answering` have left word that they are alive.
    """
    redis = AsyncMock()

    async def scan_iter(match=None):
        for key in processing_keys:
            yield key

    async def exists(key):
        return int(key in {f"judge:workers:{owner}" for owner in answering})

    redis.scan_iter = scan_iter
    redis.exists = exists
    return redis


async def test_announce_leaves_a_mark_that_expires_on_its_own():
    redis = AsyncMock()

    await announce(redis)

    assert redis.set.await_args.args[0] == f"judge:workers:{worker_identity()}"
    assert redis.set.await_args.kwargs["ex"] == get_settings().heartbeat_ttl_sec


async def test_withdraw_takes_our_mark_back():
    redis = AsyncMock()

    await withdraw(redis)

    redis.delete.assert_awaited_once_with(f"judge:workers:{worker_identity()}")


def test_the_mark_outlives_several_missed_heartbeats():
    settings = get_settings()

    assert settings.heartbeat_ttl_sec >= settings.heartbeat_sec * 3


async def test_recover_orphans_requeues_until_empty():
    redis = _redis_holding("judge:processing:box:10:aaaaaaaa")
    redis.lmove.side_effect = [VALID_RAW, VALID_RAW, None]

    await recover_orphans(redis)

    assert redis.lmove.await_count == 3
    assert all(c.args[1] == "judge:queue" for c in redis.lmove.await_args_list)


async def test_recover_orphans_leaves_a_worker_that_still_answers():
    redis = _redis_holding(
        "judge:processing:box:11:bbbbbbbb", answering=("box:11:bbbbbbbb",)
    )

    await recover_orphans(redis)

    redis.lmove.assert_not_awaited()


async def test_recover_orphans_never_touches_our_own_list():
    redis = _redis_holding(get_settings().processing_key)

    await recover_orphans(redis)

    redis.lmove.assert_not_awaited()


async def test_recover_orphans_takes_the_silent_worker_and_not_the_live_one():
    live = "judge:processing:box:11:bbbbbbbb"
    silent = "judge:processing:box:12:cccccccc"
    redis = _redis_holding(live, silent, answering=("box:11:bbbbbbbb",))
    redis.lmove.side_effect = [VALID_RAW, None]

    await recover_orphans(redis)

    assert {c.args[0] for c in redis.lmove.await_args_list} == {silent}


async def test_recover_orphans_reaches_a_container_that_no_longer_exists():
    """A deploy builds the judge under a new name, and the submissions the old
    one was holding must still be found."""
    left_behind = "judge:processing:b00af97f00d3:9:dddddddd"
    redis = _redis_holding(left_behind)
    redis.lmove.side_effect = [VALID_RAW, None]

    await recover_orphans(redis)

    assert redis.lmove.await_args_list[0].args[0] == left_behind


async def test_maintenance_loop_keeps_going_after_a_failed_pass():
    redis = AsyncMock()
    passes = 0

    async def stop_on_second(_seconds):
        nonlocal passes
        passes += 1
        if passes == 2:
            raise asyncio.CancelledError

    with (
        patch(
            "app.worker.announce",
            new=AsyncMock(side_effect=[RuntimeError("redis blip"), None]),
        ) as mark,
        patch("app.worker.recover_orphans", new=AsyncMock()) as sweep,
        patch("app.worker.asyncio.sleep", stop_on_second),
        pytest.raises(asyncio.CancelledError),
    ):
        await maintenance_loop(redis)

    assert mark.await_count == 2
    assert sweep.await_count == 1


def test_worker_identity_holds_still_within_a_process():
    assert worker_identity() == worker_identity()


def test_worker_identity_is_never_handed_down(monkeypatch):
    """Same container, same pid, and still a different name: a list left by a
    dead worker must never look like it belongs to the one that replaced it."""
    monkeypatch.setattr(socket, "gethostname", lambda: "judge-box")
    monkeypatch.setattr(os, "getpid", lambda: 10)

    monkeypatch.setattr(config, "_identity", None)
    first = worker_identity()
    # A fresh process starts with a fresh module, and this one was handed the
    # pid of the worker that just died.
    monkeypatch.setattr(config, "_identity", None)
    second = worker_identity()

    assert first.startswith("judge-box:10:")
    assert second.startswith("judge-box:10:")
    assert first != second


def test_processing_key_belongs_to_this_worker():
    assert get_settings().processing_key == f"judge:processing:{worker_identity()}"
