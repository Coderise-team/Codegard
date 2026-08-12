import asyncio
import logging

from pydantic import ValidationError
from redis.asyncio import Redis
from schemas.request import SubmissionRequest
from schemas.response import SubmissionResponse, VerdictEnum

from app.config import get_settings, worker_identity
from app.core.runner import run_submission

logger = logging.getLogger(__name__)


def _attempts_key(submission_id: int) -> str:
    return f"judge:attempts:{submission_id}"


def _internal_failure(submission_id: int) -> SubmissionResponse:
    return SubmissionResponse(
        submission_id=submission_id,
        verdict=VerdictEnum.RE,
        error_message="Internal judge error",
    )


async def _finish(redis: Redis, raw: str, response: SubmissionResponse) -> None:
    settings = get_settings()
    await redis.rpush(settings.judge_results_key, response.model_dump_json())
    await redis.lrem(settings.processing_key, 1, raw)
    await redis.delete(_attempts_key(response.submission_id))


async def handle_one(redis: Redis, raw: str) -> None:
    settings = get_settings()
    try:
        request = SubmissionRequest.model_validate_json(raw)
    except ValidationError:
        logger.exception("Malformed submission payload, dropping: %.200s", raw)
        await redis.rpush(settings.judge_dead_key, raw)
        await redis.lrem(settings.processing_key, 1, raw)
        return

    attempts = await redis.incr(_attempts_key(request.submission_id))
    await redis.expire(_attempts_key(request.submission_id), settings.attempts_ttl_sec)
    if attempts > settings.max_attempts:
        logger.error(
            "Submission #%s exceeded %s attempts → dead-letter",
            request.submission_id,
            settings.max_attempts,
        )
        await redis.rpush(settings.judge_dead_key, raw)
        await _finish(redis, raw, _internal_failure(request.submission_id))
        return

    try:
        response = await asyncio.to_thread(run_submission, request)
    except Exception:
        logger.exception("run_submission failed for #%s", request.submission_id)
        response = _internal_failure(request.submission_id)
    await _finish(redis, raw, response)


async def announce(redis: Redis) -> None:
    """Leave word that this worker is alive, to be repeated before it expires.

    This word is the only thing that tells a submission being judged right now
    from one whose worker is never coming back. It cannot be told from the
    machine: a deploy builds a new container under a new name, and one
    container cannot see into another's process table anyway.
    """
    settings = get_settings()
    await redis.set(
        settings.heartbeat_key(worker_identity()),
        "1",
        ex=settings.heartbeat_ttl_sec,
    )


async def withdraw(redis: Redis) -> None:
    """Take the word back on a clean shutdown, so a deploy does not have to
    wait out the whole minute before this worker's submissions are picked up."""
    settings = get_settings()
    await redis.delete(settings.heartbeat_key(worker_identity()))


async def _drain(redis: Redis, processing_key: str, queue_key: str) -> int:
    count = 0
    while (
        await redis.lmove(processing_key, queue_key, src="LEFT", dest="LEFT")
        is not None
    ):
        count += 1
    return count


async def recover_orphans(redis: Redis) -> None:
    """Return to the queue the submissions of workers that stopped answering."""
    settings = get_settings()
    me = worker_identity()
    owner_at = len(settings.judge_processing_key) + 1
    count = 0
    async for key in redis.scan_iter(match=f"{settings.judge_processing_key}:*"):
        owner = key[owner_at:]
        # Our own list is what we are judging this second, and a worker still
        # leaving word is judging its own. Neither is anyone else's to take.
        if owner == me or await redis.exists(settings.heartbeat_key(owner)):
            continue
        count += await _drain(redis, key, settings.judge_queue_key)
    if count:
        logger.warning("Recovered %s submission(s) from workers that are gone", count)


async def maintenance_loop(redis: Redis) -> None:
    """Keep saying we are here, and keep watch for those who stopped saying it.

    On a loop rather than at startup alone: a worker can die at a moment when
    nothing else is starting, and its submissions would wait for the next
    deploy to be noticed.
    """
    settings = get_settings()
    while True:
        try:
            await announce(redis)
            await recover_orphans(redis)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Maintenance pass failed, retrying in %ss", settings.heartbeat_sec
            )
        await asyncio.sleep(settings.heartbeat_sec)


async def worker_loop(redis: Redis) -> None:
    settings = get_settings()
    while True:
        try:
            raw = await redis.blmove(
                settings.judge_queue_key,
                settings.processing_key,
                settings.worker_poll_timeout,
                src="LEFT",
                dest="RIGHT",
            )
            if raw is None:
                continue
            await handle_one(redis, raw)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Worker loop error, backing off %ss", settings.worker_backoff_sec
            )
            await asyncio.sleep(settings.worker_backoff_sec)
