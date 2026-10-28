from pydantic import BaseModel


class SafetyDecision(BaseModel):
    allowed: bool
    reason: str | None = None
    suggested_alternative: str | None = None
