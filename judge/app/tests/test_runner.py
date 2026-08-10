from unittest.mock import patch

from schemas.request import ProblemTestCasePayload, SubmissionRequest
from schemas.response import VerdictEnum

from app.core.runner import STDERR_LIMIT_CHARS, TRUNCATION_NOTE, run_submission

from .conftest import make_sandbox_result


def make_request(test_cases: list | None = None) -> SubmissionRequest:
    if test_cases is None:
        test_cases = [ProblemTestCasePayload(input="", expected_output="42")]
    return SubmissionRequest(
        submission_id=1,
        language="python",
        code="print(42)",
        time_limit_ms=1000,
        memory_limit_mb=128,
        test_cases=test_cases,
    )


class TestRunSubmission:
    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_all_ac_returns_ac(self, mock_sandbox, mock_verdict):
        mock_sandbox.return_value = make_sandbox_result(stdout="42\n")
        mock_verdict.return_value = VerdictEnum.AC

        result = run_submission(make_request())

        assert result.verdict == VerdictEnum.AC
        assert result.submission_id == 1

    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_stops_at_first_failure(self, mock_sandbox, mock_verdict):
        mock_sandbox.return_value = make_sandbox_result()
        mock_verdict.return_value = VerdictEnum.WA

        request = make_request(
            test_cases=[
                ProblemTestCasePayload(input="", expected_output="1"),
                ProblemTestCasePayload(input="", expected_output="2"),
                ProblemTestCasePayload(input="", expected_output="3"),
            ]
        )
        result = run_submission(request)

        assert result.verdict == VerdictEnum.WA
        assert mock_sandbox.call_count == 1

    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_empty_test_cases_returns_ac(self, mock_sandbox, mock_verdict):
        result = run_submission(make_request(test_cases=[]))

        assert result.verdict == VerdictEnum.AC
        mock_sandbox.assert_not_called()

    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_execution_time_is_max_across_test_cases(self, mock_sandbox, mock_verdict):
        mock_sandbox.side_effect = [
            make_sandbox_result(execution_time_ms=100),
            make_sandbox_result(execution_time_ms=250),
            make_sandbox_result(execution_time_ms=80),
        ]
        mock_verdict.return_value = VerdictEnum.AC

        request = make_request(
            test_cases=[
                ProblemTestCasePayload(input="", expected_output="1"),
                ProblemTestCasePayload(input="", expected_output="2"),
                ProblemTestCasePayload(input="", expected_output="3"),
            ]
        )
        result = run_submission(request)

        assert result.execution_time_ms == 250

    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_stderr_included_on_failure(self, mock_sandbox, mock_verdict):
        mock_sandbox.return_value = make_sandbox_result(
            stderr="NameError: name 'x' is not defined\n", exit_code=1
        )
        mock_verdict.return_value = VerdictEnum.RE

        result = run_submission(make_request())

        assert result.stderr is not None
        assert "NameError" in result.stderr

    @patch("app.core.runner.determine_verdict")
    @patch("app.core.runner.run_in_sandbox")
    def test_endless_stderr_is_trimmed(self, mock_sandbox, mock_verdict):
        """A runaway process must not push megabytes through Redis and the DB."""
        mock_sandbox.return_value = make_sandbox_result(
            stderr="boom\n" * 100_000, exit_code=1
        )
        mock_verdict.return_value = VerdictEnum.RE

        result = run_submission(make_request())

        assert len(result.stderr) == STDERR_LIMIT_CHARS + len(TRUNCATION_NOTE)
        assert result.stderr.startswith("boom")
        assert result.stderr.endswith(TRUNCATION_NOTE)
