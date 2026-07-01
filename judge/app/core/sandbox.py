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

logger = logging.getLogger(__name__)

_PYTHON_IMAGE = "python:3.13-slim"
_CPU_QUOTA = 100_000
_CPU_PERIOD = 100_000
_TIMEOUT_BUFFER_SEC = 2.0


@dataclass
class SandboxResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    oom_killed: bool
    execution_time_ms: int


_docker_client: docker.DockerClient | None = None


def _get_docker_client() -> docker.DockerClient:
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


def _build_command(code: str, stdin: str) -> list[str]:
    """
    Shell command that decodes the base64 solution into a file, then runs it
    with the base64-decoded stdin piped in. base64 keeps the payload free of
    shell metacharacters, so code with any quotes passes through byte-for-byte.
    """
    code_b64 = base64.b64encode(code.encode()).decode()
    input_b64 = base64.b64encode(stdin.encode()).decode()
    script = (
        f"echo {code_b64} | base64 -d > /tmp/solution.py && "
        f"echo {input_b64} | base64 -d | python /tmp/solution.py"
    )
    return ["sh", "-c", script]


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
            image=_PYTHON_IMAGE,
            command=_build_command(code, stdin),
            mem_limit=f"{memory_limit_mb}m",
            cpu_quota=_CPU_QUOTA,
            cpu_period=_CPU_PERIOD,
            network_disabled=True,
            read_only=True,
            tmpfs={"/tmp": "size=64m"},
            pids_limit=20,
            user="nobody",
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

        container.reload()
        oom_killed = container.attrs["State"].get("OOMKilled", False)

        return SandboxResult(
            stdout=stdout_bytes.decode(errors="replace"),
            stderr=stderr_bytes.decode(errors="replace"),
            exit_code=exit_code if exit_code is not None else -1,
            timed_out=False,
            oom_killed=oom_killed,
            execution_time_ms=elapsed_ms,
        )

    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except docker.errors.APIError as e:
                logger.warning("Failed to remove container %s: %s", container.id, e)
