"""
Consume judge results from Redis and apply verdicts to submissions.

The judge worker pushes a `SubmissionResponse` (JSON) onto `judge:results`.
This long-running management command is the last link in the chain: it reads
that queue with a blocking `BLMOVE`, applies the verdict via `instance.save()`
(which fires the `post_save` signals — score recalc + websocket push), and
reliably drains the queue.

Mirrors `judge/app/worker.py` (reliable queue: blmove → processing → lrem,
recover_orphans, dead-letter), but synchronous and on the Django side.
"""

import logging
import signal
import time
from pathlib import Path

from apps.submissions.models import Submission
from apps.submissions.tasks import get_redis_client
from django.core.management.base import BaseCommand
from django.db import transaction
from pydantic import ValidationError
from schemas.response import SubmissionResponse

logger = logging.getLogger(__name__)

RESULTS_KEY = "judge:results"
PROCESSING_KEY = "judge:results:processing"
DEAD_KEY = "judge:results:dead"
BLMOVE_TIMEOUT = 5
BACKOFF_SEC = 1.0
MAX_ATTEMPTS = 5
ATTEMPTS_TTL_SEC = 3600
HEARTBEAT_FILE = "/tmp/consumer_heartbeat"


def _attempts_key(submission_id: int) -> str:
    return f"judge:results:attempts:{submission_id}"


@transaction.atomic
def apply_result(response: SubmissionResponse) -> bool:
    """
    Apply a judge result to the matching Submission, inside a transaction.

    Returns True if the submission exists (verdict applied, or it was already
    final and skipped via dedup); False if no such submission is in the DB.

    `select_for_update` + the dedup check make the shared processing channel
    safe: two consumers racing on the same submission are serialised by the
    row lock, and the second one hits the dedup.
    """
    submission = (
        Submission.objects.select_for_update().filter(pk=response.submission_id).first()
    )
    if submission is None:
        return False

    # Dedup: a verdict already set means this is a redelivery (at-least-once).
    # Skip silently — no second .save(), no duplicate signals.
    if submission.verdict is not None:
        return True

    submission.verdict = response.verdict.value
    submission.execution_time_ms = response.execution_time_ms
    submission.memory_used_mb = response.memory_used_mb
    submission.stderr = response.stderr
    submission.error_message = response.error_message
    submission.save()  # fires post_save signals (score recalc + websocket)
    logger.info(
        "Applied verdict %s for submission #%s", submission.verdict, submission.pk
    )
    return True


def process_message(redis, raw: str) -> None:
    """Handle one raw result string already moved into the processing list."""
    try:
        response = SubmissionResponse.model_validate_json(raw)
    except ValidationError:
        # Malformed JSON will never become valid — dead-letter it.
        logger.exception("Malformed judge result, dead-lettering: %.200s", raw)
        redis.rpush(DEAD_KEY, raw)
        redis.lrem(PROCESSING_KEY, 1, raw)
        return

    try:
        found = apply_result(response)
    except Exception:
        # Transient failure (DB unavailable, etc.) — never lose the result.
        attempts = redis.incr(_attempts_key(response.submission_id))
        redis.expire(_attempts_key(response.submission_id), ATTEMPTS_TTL_SEC)
        if attempts > MAX_ATTEMPTS:
            logger.error(
                "Result for #%s exceeded %s attempts → dead-letter",
                response.submission_id,
                MAX_ATTEMPTS,
            )
            redis.rpush(DEAD_KEY, raw)
            redis.lrem(PROCESSING_KEY, 1, raw)
            redis.delete(_attempts_key(response.submission_id))
        else:
            logger.exception(
                "Failed to apply result for #%s, requeueing (attempt %s)",
                response.submission_id,
                attempts,
            )
            # Requeue first, then drop from processing: a crash between the two
            # leaves a duplicate, which the dedup in apply_result absorbs.
            redis.rpush(RESULTS_KEY, raw)
            redis.lrem(PROCESSING_KEY, 1, raw)
            # Pace retries: without this the loop re-picks the message instantly
            # and burns all attempts in milliseconds during a brief DB blip.
            time.sleep(BACKOFF_SEC)
        return

    if not found:
        # Not dead-letter: the message is fine, a retry won't help — the
        # submission was probably deleted.
        logger.warning(
            "Result for unknown submission #%s, discarding", response.submission_id
        )
    redis.delete(_attempts_key(response.submission_id))
    redis.lrem(PROCESSING_KEY, 1, raw)


def recover_orphans(redis) -> None:
    """Re-queue anything stuck in the shared processing list on startup."""
    count = 0
    while redis.lmove(PROCESSING_KEY, RESULTS_KEY, src="LEFT", dest="LEFT") is not None:
        count += 1
    if count:
        logger.warning("Recovered %s orphaned result(s) from processing", count)


class Command(BaseCommand):
    help = "Consume judge results from Redis and apply verdicts to submissions."

    def handle(self, *args, **options):
        """Run the blocking drain loop until SIGTERM/SIGINT.

        Recovers orphaned results on startup, then repeatedly ``BLMOVE``s one
        result from the queue into a processing list and applies it, touching a
        heartbeat file each pass for the docker healthcheck and shutting down
        cleanly on a signal boundary.
        """
        # Surface this command's INFO logs even without a project-wide LOGGING
        # config: setting the level alone is not enough — there's no handler, so
        # records propagate to root where the default handler drops < WARNING.
        # Attach our own stdout handler.
        consumer_logger = logging.getLogger("apps.submissions")
        if not any(
            getattr(h, "_judge_consumer", False) for h in consumer_logger.handlers
        ):
            handler = logging.StreamHandler()
            handler.setFormatter(
                logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
            )
            handler._judge_consumer = True
            consumer_logger.addHandler(handler)
        consumer_logger.setLevel(logging.INFO)
        consumer_logger.propagate = False

        self._running = True

        def _stop(signum, frame):
            # docker stop sends SIGTERM, which Python does NOT turn into an
            # exception — without this handler the loop would be killed
            # mid-iteration instead of finishing cleanly on a boundary.
            logger.info("Got signal %s, shutting down gracefully", signum)
            self._running = False

        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

        redis = get_redis_client()
        recover_orphans(redis)
        logger.info("judge-results consumer started, listening on %s", RESULTS_KEY)

        while self._running:
            # Liveness for the docker healthcheck.
            Path(HEARTBEAT_FILE).touch()
            try:
                # FIFO: worker RPUSHes to the tail → read from the head.
                # BLMOVE_TIMEOUT bounds the block so we re-check _running and
                # exit within the docker grace period even on an empty queue.
                raw = redis.blmove(
                    RESULTS_KEY,
                    PROCESSING_KEY,
                    BLMOVE_TIMEOUT,
                    src="LEFT",
                    dest="RIGHT",
                )
                if raw is None:
                    continue
                process_message(redis, raw)
            except Exception:
                # Message stays in processing → recover_orphans picks it up.
                logger.exception("Consumer loop error, backing off %ss", BACKOFF_SEC)
                time.sleep(BACKOFF_SEC)

        logger.info("judge-results consumer stopped")
