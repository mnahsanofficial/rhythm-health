from pydantic import BaseModel


class HabitCheck(BaseModel):
    """A soft check: the person can use the rewording, or continue anyway."""

    message: str
    suggested_question: str


class SafetyDecision(BaseModel):
    allowed: bool
    reason: str | None = None
    suggested_alternative: str | None = None
