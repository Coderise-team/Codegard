import os
from unittest.mock import MagicMock

os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app.core.sandbox import SandboxResult


def make_sandbox_result(**overrides) -> SandboxResult:
    defaults = {
        "stdout": "",
        "stderr": "",
        "exit_code": 0,
        "timed_out": False,
        "oom_killed": False,
        "execution_time_ms": 50,
    }
    return SandboxResult(**{**defaults, **overrides})


def make_mock_docker_client(
    stdout: bytes = b"",
    stderr: bytes = b"",
    exit_code: int = 0,
    oom_killed: bool = False,
) -> MagicMock:
    """Mock Docker client for the base64 / main-process sandbox model."""
    client = MagicMock()

    container = MagicMock()
    container.id = "test-container-id"
    container.attrs = {"State": {"OOMKilled": oom_killed}}
    container.wait.return_value = {"StatusCode": exit_code}

    out_bytes, err_bytes = stdout, stderr

    def logs(**kwargs):
        if kwargs.get("stdout"):
            return out_bytes
        if kwargs.get("stderr"):
            return err_bytes
        return b""

    container.logs.side_effect = logs
    client.containers.run.return_value = container
    return client
