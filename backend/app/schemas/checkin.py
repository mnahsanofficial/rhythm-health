from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StrictBool, StrictFloat, StrictInt, StringConstraints

from app.schemas.experiment import Metric
from app.schemas.progress import Phase

MetricValue = StrictBool | StrictInt | StrictFloat
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class CheckinIn(BaseModel):
    """Today's check-in. No day, phase, experiment or user id: the backend derives them."""

    model_config = ConfigDict(extra="forbid")

    # Required during the intervention phase, ignored (stored as false) during baseline.
    intervention_completed: bool | None = None
    # One value per metric key defined by the experiment.
    metric_values: dict[str, MetricValue]
    note: Note | None = None


class CheckinOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    experiment_id: UUID
    phase: Phase
    day_number: int
    intervention_completed: bool
    metric_values: dict[str, MetricValue]
    note: str | None
    created_at: datetime
    updated_at: datetime


class TodayQuestion(BaseModel):
    """One question in the combined check-in, and the experiments its answer feeds."""

    id: str
    metric: Metric
    experiment_ids: list[str]
    value: MetricValue | None = None


class TodayExperiment(BaseModel):
    id: str
    question: str
    action: str
    change_short: str
    short_name: str
    timing: str
    day_number: int
    total_days: int
    phase: Phase
    change_required: bool
    change_made: bool | None = None
    recorded: bool


class TodayCheckin(BaseModel):
    """Every experiment with a day open now. The backend decides what combines."""

    revision: str
    experiments: list[TodayExperiment]
    questions: list[TodayQuestion]
    note: str | None = None
    all_recorded: bool


class TodayCheckinIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # From the form this answers: a mismatch means the day or the questions have changed.
    revision: str
    # Keyed by TodayQuestion.id.
    answers: dict[str, MetricValue]
    # Keyed by experiment id, for those in their test phase.
    changes: dict[str, bool] = {}
    note: Note | None = None
