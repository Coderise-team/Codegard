import base64
import time
from unittest.mock import MagicMock

import docker.errors
import pytest
import requests

from app.config import worker_identity
from app.core.sandbox import (
    OWNER_LABEL,
    SANDBOX_LABEL,
    list_sandbox_owners,
    remove_sandbox,
    run_in_sandbox,
)

from .conftest import make_mock_docker_client


def _patch(monkeypatch, client):
    monkeypatch.setattr("app.core.sandbox._get_docker_client", lambda: client)


def _fail_wait(client):
    client.containers.run.return_value.wait.side_effect = (
        requests.exceptions.ReadTimeout
    )


class TestRunInSandbox:
    def test_successful_execution_returns_stdout(self, monkeypatch):
        client = make_mock_docker_client(stdout=b"42\n")
        _patch(monkeypatch, client)

        result = run_in_sandbox("print(42)", "", 1000, 256)

        assert result.stdout == "42\n"
        assert result.exit_code == 0
        assert not result.timed_out
        assert not result.oom_killed

    def test_stderr_captured_separately(self, monkeypatch):
        client = make_mock_docker_client(
            stderr=b"ZeroDivisionError: division by zero\n", exit_code=1
        )
        _patch(monkeypatch, client)

        result = run_in_sandbox("1/0", "", 1000, 256)

        assert result.exit_code == 1
        assert "ZeroDivisionError" in result.stderr

    def test_container_removed_on_success(self, monkeypatch):
        client = make_mock_docker_client(stdout=b"ok\n")
        _patch(monkeypatch, client)

        run_in_sandbox("print('ok')", "", 1000, 256)

        client.containers.run.return_value.remove.assert_called_once_with(force=True)

    def test_timeout_sets_timed_out_flag(self, monkeypatch):
        client = make_mock_docker_client()
        _fail_wait(client)
        _patch(monkeypatch, client)

        result = run_in_sandbox("while True: pass", "", 100, 256)

        assert result.timed_out
        assert result.exit_code == -1

    def test_timeout_kills_container(self, monkeypatch):
        client = make_mock_docker_client()
        _fail_wait(client)
        _patch(monkeypatch, client)

        run_in_sandbox("while True: pass", "", 100, 256)

        client.containers.run.return_value.kill.assert_called_once()

    def test_container_removed_after_timeout(self, monkeypatch):
        client = make_mock_docker_client()
        _fail_wait(client)
        _patch(monkeypatch, client)

        run_in_sandbox("while True: pass", "", 100, 256)

        client.containers.run.return_value.remove.assert_called_once_with(force=True)

    def test_kill_api_error_swallowed_on_timeout(self, monkeypatch):
        client = make_mock_docker_client()
        _fail_wait(client)
        client.containers.run.return_value.kill.side_effect = docker.errors.APIError(
            "container already stopped"
        )
        _patch(monkeypatch, client)

        result = run_in_sandbox("pass", "", 100, 256)

        assert result.timed_out  # Did not raise

    def test_oom_killed_detected(self, monkeypatch):
        client = make_mock_docker_client(exit_code=137, oom_killed=True)
        _patch(monkeypatch, client)

        result = run_in_sandbox("x = b'A' * (200 * 2**20)", "", 5000, 256)

        assert result.oom_killed
        assert not result.timed_out

    def test_resource_limits_applied(self, monkeypatch):
        client = make_mock_docker_client()
        _patch(monkeypatch, client)

        run_in_sandbox("pass", "", 1000, 200)

        kwargs = client.containers.run.call_args.kwargs
        assert kwargs["mem_limit"] == "200m"
        assert kwargs["cpu_quota"] == 100_000
        assert kwargs["cpu_period"] == 100_000
        assert kwargs["network_disabled"] is True
        assert kwargs["read_only"] is True
        assert kwargs["pids_limit"] == 20

    def test_sandbox_is_stamped_as_ours_and_signed_by_its_worker(self, monkeypatch):
        client = make_mock_docker_client()
        _patch(monkeypatch, client)

        run_in_sandbox("pass", "", 1000, 256)

        labels = client.containers.run.call_args.kwargs["labels"]
        assert labels[SANDBOX_LABEL] == "1"
        assert labels[OWNER_LABEL] == worker_identity()

    def test_code_and_stdin_passed_as_base64(self, monkeypatch):
        client = make_mock_docker_client()
        _patch(monkeypatch, client)

        run_in_sandbox("print('hi')", "hello", 1000, 256)

        script = client.containers.run.call_args.kwargs["command"][-1]
        assert base64.b64encode(b"print('hi')").decode() in script
        assert base64.b64encode(b"hello").decode() in script
        assert "base64 -d" in script

    def test_soft_tle_when_elapsed_exceeds_limit(self, monkeypatch):
        # Container finishes on its own (no hard timeout) but overruns the
        # actual limit -> still TLE.
        client = make_mock_docker_client()

        def slow_wait(**kwargs):
            time.sleep(0.05)
            return {"StatusCode": 0}

        client.containers.run.return_value.wait.side_effect = slow_wait
        _patch(monkeypatch, client)

        result = run_in_sandbox("pass", "", 1, 256)  # 1ms limit, ran ~50ms

        assert result.timed_out
        assert result.exit_code == -1

    def test_output_limit_exceeded_detected(self, monkeypatch):
        monkeypatch.setattr("app.core.sandbox._OUTPUT_LIMIT_BYTES", 10)
        client = make_mock_docker_client(stdout=b"A" * 20)
        _patch(monkeypatch, client)

        result = run_in_sandbox("print('x' * 100)", "", 1000, 256)

        assert result.output_limit_exceeded

    def test_unsupported_language_raises(self, monkeypatch):
        client = make_mock_docker_client()
        _patch(monkeypatch, client)

        with pytest.raises(NotImplementedError):
            run_in_sandbox("print(1)", "", 1000, 256, language="cpp")

    def test_remove_api_error_is_logged_not_raised(self, monkeypatch):
        client = make_mock_docker_client()
        client.containers.run.return_value.remove.side_effect = docker.errors.APIError(
            "remove failed"
        )
        _patch(monkeypatch, client)

        run_in_sandbox("pass", "", 1000, 256)  # Must not raise


class TestSandboxHousekeeping:
    def test_lists_sandboxes_with_the_worker_that_asked_for_them(self, monkeypatch):
        client = make_mock_docker_client()
        left_behind = MagicMock()
        left_behind.id = "abc123"
        left_behind.labels = {SANDBOX_LABEL: "1", OWNER_LABEL: "box:9:deadbeef"}
        client.containers.list.return_value = [left_behind]
        _patch(monkeypatch, client)

        assert list_sandbox_owners() == [("abc123", "box:9:deadbeef")]
        assert client.containers.list.call_args.kwargs["all"] is True
        assert client.containers.list.call_args.kwargs["filters"] == {
            "label": SANDBOX_LABEL
        }

    def test_a_sandbox_without_an_owner_is_still_listed(self, monkeypatch):
        client = make_mock_docker_client()
        nameless = MagicMock()
        nameless.id = "abc123"
        nameless.labels = {SANDBOX_LABEL: "1"}
        client.containers.list.return_value = [nameless]
        _patch(monkeypatch, client)

        assert list_sandbox_owners() == [("abc123", "")]

    def test_remove_forces_the_container_out(self, monkeypatch):
        client = make_mock_docker_client()
        _patch(monkeypatch, client)

        remove_sandbox("abc123")

        client.containers.get.return_value.remove.assert_called_once_with(force=True)

    def test_remove_says_nothing_about_one_that_is_already_gone(self, monkeypatch):
        client = make_mock_docker_client()
        client.containers.get.side_effect = docker.errors.NotFound("gone")
        _patch(monkeypatch, client)

        remove_sandbox("abc123")  # Must not raise

    def test_remove_survives_a_docker_that_refuses(self, monkeypatch):
        client = make_mock_docker_client()
        client.containers.get.return_value.remove.side_effect = docker.errors.APIError(
            "busy"
        )
        _patch(monkeypatch, client)

        remove_sandbox("abc123")  # Must not raise
