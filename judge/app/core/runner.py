from schemas.request import SubmissionRequest
from schemas.response import SubmissionResponse, VerdictEnum

from .sandbox import run_in_sandbox
from .verdict import determine_verdict


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
        stderr=last_result.stderr if last_result and last_result.stderr else None,
    )
