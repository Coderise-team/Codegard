from schemas.request import SubmissionRequest
from schemas.response import SubmissionResponse, VerdictEnum

from .sandbox import run_in_sandbox
from .verdict import determine_verdict

# The sandbox caps output at 64 MB, which is a guard against a runaway process,
# not a size worth carrying: this text travels through Redis, into a database
# column and on to the browser. The first lines hold the traceback that the
# author actually needs.
STDERR_LIMIT_CHARS = 2000
TRUNCATION_NOTE = "\n... truncated"


def _trim_stderr(stderr: str | None) -> str | None:
    if not stderr:
        return None
    if len(stderr) <= STDERR_LIMIT_CHARS:
        return stderr
    return stderr[:STDERR_LIMIT_CHARS] + TRUNCATION_NOTE


def run_submission(request: SubmissionRequest) -> SubmissionResponse:
    """Run code against all test cases; stop at first failure."""
    all_results = []
    verdict = VerdictEnum.AC

    for tc in request.test_cases:
        result = run_in_sandbox(
            code=request.code,
            stdin=tc.input,
            time_limit_ms=request.time_limit_ms,
            memory_limit_mb=request.memory_limit_mb,
            language=request.language,
        )
        all_results.append(result)
        verdict = determine_verdict(result, tc.expected_output)
        if verdict != VerdictEnum.AC:
            break

    last_result = all_results[-1] if all_results else None
    return SubmissionResponse(
        submission_id=request.submission_id,
        verdict=verdict,
        execution_time_ms=max(r.execution_time_ms for r in all_results)
        if all_results
        else None,
        memory_used_mb=None,
        stderr=_trim_stderr(last_result.stderr if last_result else None),
    )
