import pytest
from pydantic import ValidationError
from schemas import (
    LanguageEnum,
    ProblemTestCasePayload,
    SubmissionRequest,
    SubmissionResponse,
    VerdictEnum,
)


def _valid_request(**overrides) -> dict:
    base = {
        "submission_id": 1,
        "language": "python",
        "code": "print('hello')",
        "time_limit_ms": 2000,
        "memory_limit_mb": 256,
        "test_cases": [{"input": "1\n", "expected_output": "1\n"}],
    }
    return {**base, **overrides}


class TestSubmissionRequest:
    def test_valid(self):
        req = SubmissionRequest(**_valid_request())
        assert req.submission_id == 1
        assert req.language == LanguageEnum.PYTHON
        assert len(req.test_cases) == 1

    def test_invalid_language_rejected(self):
        with pytest.raises(ValidationError):
            SubmissionRequest(**_valid_request(language="cpp"))

    def test_missing_required_field(self):
        data = _valid_request()
        del data["code"]
        with pytest.raises(ValidationError):
            SubmissionRequest(**data)

    def test_empty_test_cases_is_valid(self):
        req = SubmissionRequest(**_valid_request(test_cases=[]))
        assert req.test_cases == []

    def test_test_case_payload_fields(self):
        tc = ProblemTestCasePayload(input="2\n", expected_output="4\n")
        assert tc.input == "2\n"
        assert tc.expected_output == "4\n"


class TestSubmissionResponse:
    def test_ac_all_none(self):
        resp = SubmissionResponse(submission_id=1, verdict=VerdictEnum.AC)
        assert resp.verdict == VerdictEnum.AC
        assert resp.execution_time_ms is None
        assert resp.memory_used_mb is None
        assert resp.stderr is None
        assert resp.error_message is None

    def test_ce_with_error_message(self):
        resp = SubmissionResponse(
            submission_id=1,
            verdict=VerdictEnum.CE,
            error_message="SyntaxError: invalid syntax",
        )
        assert resp.verdict == VerdictEnum.CE
        assert resp.error_message == "SyntaxError: invalid syntax"

    def test_invalid_verdict_rejected(self):
        with pytest.raises(ValidationError):
            SubmissionResponse(submission_id=1, verdict="INVALID")


class TestVerdictEnum:
    def test_exactly_seven_values(self):
        assert len(VerdictEnum) == 7

    def test_all_values_present(self):
        values = {v.value for v in VerdictEnum}
        assert values == {"AC", "WA", "TLE", "MLE", "OLE", "RE", "CE"}
