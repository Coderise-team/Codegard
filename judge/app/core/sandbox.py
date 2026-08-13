"""
Isolated code execution in a fresh Docker container.

Each call to run_in_sandbox spins up a new container whose main process both
writes the solution to disk and runs it. The solution and its stdin are passed
base64-encoded as command arguments (base64 is shell-safe, so any quotes in the
user's code survive intact). Output is read back via container logs after the
process exits. Containers are never reused between submissions.
"""

import base64
import logging
import time
from dataclasses import dataclass

import docker
import docker.errors
import requests

from app.config import worker_identity

logger = logging.getLogger(__name__)

SANDBOX_IMAGE = "python:3.13-slim"

# Stamped on every sandbox, because the host has no idea these containers are
# ours: the judge asks the host's Docker for them the same way a person at a
# terminal would, so they end up standing beside the whole stack rather than
# under it. The owner is written down as well — a sandbox outlives the worker
# that asked for it, and only the worker's own name says who to wait for.
SANDBOX_LABEL = "codegard.sandbox"
OWNER_LABEL = "codegard.worker"

_CPU_QUOTA = 100_000
_CPU_PERIOD = 100_000
_TIMEOUT_BUFFER_SEC = 2.0
_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024


@dataclass
class SandboxResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    oom_killed: bool
    execution_time_ms: int
    output_limit_exceeded: bool = False


_docker_client: docker.DockerClient | None = None
_housekeeping_client: docker.DockerClient | None = None


def _get_docker_client() -> docker.DockerClient:
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


def _get_housekeeping_client() -> docker.DockerClient:
    """A connection of its own for the clearing up below.

    Judging and clearing up run in separate threads now, and a single client is
    a single open connection: the library never promises one is safe to drive
    from two threads at once.
    """
    global _housekeeping_client
    if _housekeeping_client is None:
        _housekeeping_client = docker.from_env()
    return _housekeeping_client


def _build_command(code: str, stdin: str) -> list[str]:
    """
    Shell command that decodes the base64 solution into a file, then runs it
    with the base64-decoded stdin piped in. base64 keeps the payload free of
    shell metacharacters, so code with any quotes passes through byte-for-byte.

    Both stdout and stderr are truncated at _OUTPUT_LIMIT_BYTES (+1 so the cap
    itself is detectable) by piping through `head -c`, which caps a runaway
    output at the source instead of flooding the judge. `set -o pipefail` (bash)
    keeps the solution's real exit code visible through the stdout pipe.
    """
    code_b64 = base64.b64encode(code.encode()).decode()
    input_b64 = base64.b64encode(stdin.encode()).decode()
    cap = _OUTPUT_LIMIT_BYTES + 1
    script = (
        "set -o pipefail\n"
        f"echo {code_b64} | base64 -d > /tmp/solution.py\n"
        f"echo {input_b64} | base64 -d | python /tmp/solution.py "
        f"2> >(head -c {cap} >&2) | head -c {cap}"
    )
    return ["bash", "-c", script]


def run_in_sandbox(
    code: str,
    stdin: str,
    time_limit_ms: int,
    memory_limit_mb: int,
    language: str = "python",
) -> SandboxResult:
    """
    Execute user code in an isolated Docker container.
    Always spins up a fresh container and removes it after execution.
    """
    if language != "python":
        raise NotImplementedError(f"Language {language!r} is not supported")

    client = _get_docker_client()
    timeout_sec = time_limit_ms / 1000
    container = None

    try:
        container = client.containers.run(
            image=SANDBOX_IMAGE,
            command=_build_command(code, stdin),
            mem_limit=f"{memory_limit_mb}m",
            cpu_quota=_CPU_QUOTA,
            cpu_period=_CPU_PERIOD,
            network_disabled=True,
            read_only=True,
            tmpfs={"/tmp": "size=64m"},
            pids_limit=20,
            user="nobody",
            labels={SANDBOX_LABEL: "1", OWNER_LABEL: worker_identity()},
            detach=True,
            remove=False,
        )

        start_ms = int(time.monotonic() * 1000)
        try:
            result = container.wait(timeout=timeout_sec + _TIMEOUT_BUFFER_SEC)
            exit_code = result.get("StatusCode")
            timed_out = False
        except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError):
            timed_out = True
            exit_code = -1
            try:
                container.kill()
            except docker.errors.APIError:
                pass
        elapsed_ms = int(time.monotonic() * 1000) - start_ms

        # Soft TLE: the hard wait timeout (limit + buffer) only catches hangs;
        # a run that finished within the buffer but still overran the actual
        # limit is a Time Limit Exceeded too.
        if not timed_out and elapsed_ms > time_limit_ms:
            timed_out = True

        if timed_out:
            return SandboxResult(
                stdout="",
                stderr="",
                exit_code=-1,
                timed_out=True,
                oom_killed=False,
                execution_time_ms=elapsed_ms,
            )

        stdout_bytes = container.logs(stdout=True, stderr=False)
        stderr_bytes = container.logs(stdout=False, stderr=True)
        output_limit_exceeded = (
            len(stdout_bytes) > _OUTPUT_LIMIT_BYTES
            or len(stderr_bytes) > _OUTPUT_LIMIT_BYTES
        )

        container.reload()
        oom_killed = container.attrs["State"].get("OOMKilled", False)

        return SandboxResult(
            stdout=stdout_bytes.decode(errors="replace"),
            stderr=stderr_bytes.decode(errors="replace"),
            exit_code=exit_code if exit_code is not None else -1,
            timed_out=False,
            oom_killed=oom_killed,
            execution_time_ms=elapsed_ms,
            output_limit_exceeded=output_limit_exceeded,
        )

    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except docker.errors.APIError as e:
                logger.warning("Failed to remove container %s: %s", container.id, e)


def list_sandbox_owners() -> list[tuple[str, str]]:
    """Every sandbox on this host, as (container, the worker that asked for it).

    The clearing up this feeds cannot be left to the sandbox itself: a worker
    killed mid-judging never reaches the line above, and the container it left
    behind stays on the host for good.
    """
    client = _get_housekeeping_client()
    containers = client.containers.list(all=True, filters={"label": SANDBOX_LABEL})
    return [(c.id, c.labels.get(OWNER_LABEL, "")) for c in containers]


def remove_sandbox(container_id: str) -> None:
    client = _get_housekeeping_client()
    try:
        client.containers.get(container_id).remove(force=True)
    except docker.errors.NotFound:
        pass
    except docker.errors.APIError as e:
        logger.warning("Failed to remove sandbox %s: %s", container_id, e)
