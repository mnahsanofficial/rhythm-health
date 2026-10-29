import re
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.analysis import Analysis, SignalClass
from app.schemas.experiment import ExperimentOut

Sentence = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
Paragraph = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
# The report screen shows this as one short block, so keep it tight.
Interpretation = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]

# A short self-experiment is not proof, and we make no clinical claims (PRD 5.5, 5.7).
_OVERCLAIM = re.compile(
    r"\b(prove[sdn]?|proof|diagnos\w*|clinically significant|statistically significant|"
    r"cures?|guarantee[sd]?)\b",
    re.IGNORECASE,
)


# The forecast is made by the app before the experiment starts, not by the user.
_USER_PREDICTED = re.compile(r"\b(you|your)\s+(predicted|prediction|forecast)", re.IGNORECASE)


def _reject_overclaim(text: str) -> str:
    match = _OVERCLAIM.search(text)
    if match:
        raise ValueError(
            f"Do not use '{match.group(0)}': a short personal experiment is not proof or a medical finding"
        )
    if _USER_PREDICTED.search(text):
        raise ValueError(
            "The prediction was made by the app, not the user: say 'we predicted', 'the prediction' or 'the forecast', never 'you predicted' or 'your prediction'"
        )
    return text


class NextExperiment(BaseModel):
    question: str
    reason: str


class ReportNarrative(BaseModel):
    """The AI-written part of the Lab Report, as stored and returned.

    Deliberately plain: it is read back from the database, and rows written under older
    generation rules must keep loading. The strict rules live on NarrativeDraft.
    """

    model_config = ConfigDict(extra="ignore")

    summary: str
    interpretation: str
    personal_learnings: list[str]
    confounders: list[str]
    next_experiment: NextExperiment


class NextExperimentDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Sentence
    reason: Paragraph

    @field_validator("question", "reason")
    @classmethod
    def _no_overclaiming(cls, v: str) -> str:
        return _reject_overclaim(v)


class NarrativeDraft(BaseModel):
    """What the model must return. It explains the analysis, never changes it, and echoes
    the fixed classification so we can verify it."""

    model_config = ConfigDict(extra="forbid")

    summary: Sentence
    interpretation: Interpretation
    personal_learnings: Annotated[list[Sentence], Field(min_length=1, max_length=4)]
    # Only what the notes or data actually show. Empty when nothing stands out.
    confounders: Annotated[list[Sentence], Field(max_length=4)]
    next_experiment: NextExperimentDraft
    signal_classification: SignalClass

    @field_validator("summary", "interpretation")
    @classmethod
    def _no_overclaiming_text(cls, v: str) -> str:
        return _reject_overclaim(v)

    @field_validator("personal_learnings", "confounders")
    @classmethod
    def _no_overclaiming_list(cls, v: list[str]) -> list[str]:
        for item in v:
            _reject_overclaim(item)
        return v


class ChartMetric(BaseModel):
    key: str
    label: str
    type: str
    min: float | None = None
    max: float | None = None


class ChartPoint(BaseModel):
    day: int
    phase: str
    logged: bool
    intervention_completed: bool | None = None
    # Primary metric value, and every metric's value, for the tap/hover detail.
    value: float | None = None
    values: dict[str, bool | int | float] | None = None
    note: str | None = None


class PredictedBand(BaseModel):
    min_percent: float
    max_percent: float
    midpoint_percent: float
    # The same band in primary-metric units, applied to the baseline mean.
    expected_value_min: float
    expected_value_max: float


class ChartData(BaseModel):
    primary_metric: ChartMetric
    metrics: list[ChartMetric]
    baseline_days: int
    intervention_days: int
    # One point per planned day, including days with no check-in.
    points: list[ChartPoint]
    baseline_mean: float | None = None
    intervention_mean: float | None = None
    predicted_band: PredictedBand | None = None


class LabReport(BaseModel):
    """Everything the Lab Report screen needs, in one response."""

    experiment: ExperimentOut
    analysis: Analysis
    # Null until the report has been written (POST /report), or if writing failed.
    narrative: ReportNarrative | None = None
    chart: ChartData
    created_at: datetime
