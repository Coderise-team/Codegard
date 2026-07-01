from enum import Enum

from pydantic import BaseModel


class VerdictEnum(str, Enum):
    AC = "AC"
    WA = "WA"
    TLE = "TLE"
    MLE = "MLE"
    OLE = "OLE"
    RE = "RE"
    CE = "CE"


class SubmissionResponse(BaseModel):
    submission_id: int
    verdict: VerdictEnum
    execution_time_ms: int | None = None
    memory_used_mb: int | None = None
    stderr: str | None = None
    error_message: str | None = None
