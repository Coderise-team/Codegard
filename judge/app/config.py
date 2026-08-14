import os
import socket
from functools import lru_cache
from uuid import uuid4

from pydantic_settings import BaseSettings, SettingsConfigDict

_identity: tuple[int, str] | None = None


def worker_identity() -> str:
    """The name this worker process answers to.

    Container and pid are there to be readable in logs; the random tail is what
    makes the name unrepeatable. Without it a list left behind by a dead worker
    could be adopted by a new one that happened to get the same pid, and the
    submissions on it would sit there unjudged forever.

    Built again whenever the pid changes: uvicorn starts its workers after the
    settings have been read, and each of them has to answer for itself.
    """
    global _identity
    pid = os.getpid()
    if _identity is None or _identity[0] != pid:
        _identity = (pid, f"{socket.gethostname()}:{pid}:{uuid4().hex[:8]}")
    return _identity[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False)

    redis_url: str

    judge_queue_key: str = "judge:queue"
    judge_processing_key: str = "judge:processing"
    judge_results_key: str = "judge:results"
    judge_dead_key: str = "judge:dead"
    judge_workers_key: str = "judge:workers"

    worker_poll_timeout: int = 5
    worker_backoff_sec: float = 1.0
    max_attempts: int = 3
    attempts_ttl_sec: int = 3600

    # A worker says it is alive this often, and the word it leaves outlives four
    # missed sayings. Long enough to sit out a slow spell without its work being
    # taken away, short enough that a worker which really died is not believed
    # for long.
    heartbeat_sec: int = 15
    heartbeat_ttl_sec: int = 60

    @property
    def processing_key(self) -> str:
        return f"{self.judge_processing_key}:{worker_identity()}"

    def heartbeat_key(self, worker: str) -> str:
        return f"{self.judge_workers_key}:{worker}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
