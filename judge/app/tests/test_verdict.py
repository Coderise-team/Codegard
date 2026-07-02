from schemas.response import VerdictEnum

from app.core.verdict import determine_verdict

from .conftest import make_sandbox_result


class TestDetermineVerdict:
    def test_ac_when_output_matches(self):
        result = make_sandbox_result(stdout="42\n")
        assert determine_verdict(result, "42") == VerdictEnum.AC

    def test_wa_when_output_differs(self):
        result = make_sandbox_result(stdout="1\n")
        assert determine_verdict(result, "42") == VerdictEnum.WA

    def test_tle_on_timed_out(self):
        result = make_sandbox_result(timed_out=True)
        assert determine_verdict(result, "42") == VerdictEnum.TLE

    def test_mle_on_oom_killed(self):
        result = make_sandbox_result(oom_killed=True, exit_code=137)
        assert determine_verdict(result, "42") == VerdictEnum.MLE

    def test_re_on_nonzero_exit_code(self):
        result = make_sandbox_result(exit_code=1)
        assert determine_verdict(result, "42") == VerdictEnum.RE

    def test_ole_on_output_limit_exceeded(self):
        result = make_sandbox_result(output_limit_exceeded=True)
        assert determine_verdict(result, "42") == VerdictEnum.OLE

    def test_ac_ignores_trailing_newline(self):
        result = make_sandbox_result(stdout="42\n")
        assert determine_verdict(result, "42\n") == VerdictEnum.AC

    def test_ac_ignores_trailing_spaces_per_line(self):
        result = make_sandbox_result(stdout="hello   \n")
        assert determine_verdict(result, "hello") == VerdictEnum.AC

    def test_wa_on_extra_output_lines(self):
        result = make_sandbox_result(stdout="42\n43\n")
        assert determine_verdict(result, "42") == VerdictEnum.WA

    def test_tle_takes_priority_over_nonzero_exit(self):
        result = make_sandbox_result(timed_out=True, exit_code=137)
        assert determine_verdict(result, "42") == VerdictEnum.TLE

    def test_mle_takes_priority_over_re(self):
        result = make_sandbox_result(oom_killed=True, exit_code=137)
        assert determine_verdict(result, "42") == VerdictEnum.MLE

    def test_ole_takes_priority_over_re(self):
        # A flooding program dies with a broken pipe (non-zero exit); OLE must win.
        result = make_sandbox_result(output_limit_exceeded=True, exit_code=1)
        assert determine_verdict(result, "42") == VerdictEnum.OLE
