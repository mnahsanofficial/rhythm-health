from datetime import datetime
from typing import Annotated, Literal, Self

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.classification import Category
from app.schemas.prediction import Prediction

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
MetricKey = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{1,40}$")]


class ProposeRequest(BaseModel):
    """No user_id: the user comes from the verified token."""

    model_config = ConfigDict(extra="forbid")

    question: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)
    ]


class Intervention(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Text
    timing: Text
    frequency: Text


class Metric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: MetricKey
    label: Text
    type: Literal["scale", "number", "boolean", "duration"]
    # Required for scale metrics, null otherwise.
    min: float | None
    max: float | None
    primary: bool

    @model_validator(mode="after")
    def _scale_bounds(self) -> Self:
        if self.type == "scale":
            if self.min is None or self.max is None or self.min >= self.max:
                raise ValueError("scale metrics need min < max")
        return self


class SuccessCriteria(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary_metric: MetricKey
    minimum_change_percent: float = Field(gt=0, le=100)


class ExperimentProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Text
    hypothesis: Text
    intervention: Intervention
    baseline_days: int = Field(ge=1, le=14)
    intervention_days: int = Field(ge=1, le=28)
    metrics: Annotated[list[Metric], Field(min_length=1, max_length=6)]
    success_criteria: SuccessCriteria

    @model_validator(mode="after")
    def _consistent_metrics(self) -> Self:
        keys = [m.key for m in self.metrics]
        if len(set(keys)) != len(keys):
            raise ValueError("metric keys must be unique")
        primary = [m.key for m in self.metrics if m.primary]
        if len(primary) != 1:
            raise ValueError("exactly one metric must be primary")
        if self.success_criteria.primary_metric != primary[0]:
            raise ValueError("success_criteria.primary_metric must be the primary metric")
        return self

    @property
    def primary_metric_key(self) -> str:
        return self.success_criteria.primary_metric


ExperimentStatus = Literal["draft", "proposed", "active", "completed"]


class ExperimentOut(BaseModel):
    """A saved experiment. profile_id is deliberately not exposed."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    status: ExperimentStatus
    question: str
    category: Category
    hypothesis: str
    intervention: Intervention
    baseline_days: int
    intervention_days: int
    metrics: list[Metric]
    success_criteria: SuccessCriteria
    prediction: Prediction
    started_at: datetime | None
    completed_at: datetime | None
    is_seeded: bool
    created_at: datetime
    updated_at: datetime
