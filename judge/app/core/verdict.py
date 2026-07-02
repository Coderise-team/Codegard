from schemas.response import VerdictEnum

from .sandbox import SandboxResult


def _normalize(output: str) -> str:
    return "\n".join(line.rstrip() for line in output.rstrip().splitlines())


def determine_verdict(result: SandboxResult, expected_output: str) -> VerdictEnum:
    if result.timed_out:
        return VerdictEnum.TLE
    if result.oom_killed:
        return VerdictEnum.MLE
    if result.output_limit_exceeded:
        return VerdictEnum.OLE
    if result.exit_code != 0:
        return VerdictEnum.RE
    if _normalize(result.stdout) == _normalize(expected_output):
        return VerdictEnum.AC
    return VerdictEnum.WA
