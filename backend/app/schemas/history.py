from typing import Literal

from pydantic import BaseModel

from app.schemas.analysis import SignalClass


class PastExperiment(BaseModel):
    """What one finished experiment taught us. Summary and result only, never raw check-ins."""

    question: str
    category: str
    intervention: str
    primary_metric: str
    days: str
    completed: str  # YYYY-MM-DD
    predicted_change_min_percent: float
    predicted_change_max_percent: float
    predicted_direction: Literal["increase", "decrease", "no_change"]
    prediction_confidence: str
    observed_change_percent: float | None
    effect_size: float | None
    signal: SignalClass
    adherence_rate: float | None
    prediction_accuracy_percent: float | None
    direction_correct: bool | None
    within_predicted_range: bool | None


class TrackRecord(BaseModel):
    """How this person's past forecasts compared with what happened."""

    experiments: int
    direction_correct: int
    within_range: int
    # Mean of (observed - predicted midpoint), in percentage points. Positive means
    # results ran higher than the forecasts.
    average_error_points: float | None


class PastContext(BaseModel):
    track_record: TrackRecord
    experiments: list[PastExperiment]
