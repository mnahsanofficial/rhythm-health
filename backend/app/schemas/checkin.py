from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StrictBool, StrictFloat, StrictInt, StringConstraints

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
