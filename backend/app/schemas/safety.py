from pydantic import BaseModel


class HabitCheck(BaseModel):
    """A soft check: the person can use the rewording, or continue anyway."""

    message: str
    suggested_question: str


class SafetyDecision(BaseModel):
    allowed: bool
    reason: str | None = None
    # Advice to read. Never put this in the question box.
    suggested_alternative: str | None = None
    # A question the app can test. Only this fills the box.
    suggested_question: str | None = None
