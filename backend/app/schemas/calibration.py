from typing import Literal

from pydantic import BaseModel


class CalibrationPoint(BaseModel):
    experiment_id: str
    question: str
    completed_at: str | None = None
    guessed_change_percent: float
    observed_change_percent: float
    # How far the guess was from the result, in percentage points. Never negative.
    off_by_points: float


class Calibration(BaseModel):
    """How close this person's own guesses were to what happened, oldest first."""

    points: list[CalibrationPoint]
    average_off_by_points: float | None = None
    # None until there are two guesses to compare.
    trend: Literal["closer", "further", "steady"] | None = None
