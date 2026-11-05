from typing import Literal

from pydantic import BaseModel

OutcomeChoice = Literal["keep", "variation", "new"]


class MetricRun(BaseModel):
    """One metric in one finished experiment: your normal days against your test days."""
    experiment_id: str
    question: str
    short_name: str
    completed_at: str | None = None
    baseline_mean: float | None = None
    result_mean: float | None = None
    percent_change: float | None = None


class MetricTrend(BaseModel):
    key: str
    label: str
    short_label: str
    unit: str | None = None
    type: str
    # Oldest first.
    runs: list[MetricRun]
    # Latest normal minus first normal. None until two experiments measured it on normal days.
    normal_change: float | None = None


class KeptHabit(BaseModel):
    experiment_id: str
    question: str
    habit: str
    short_name: str
    completed_at: str | None = None


class ProgressExample(BaseModel):
    """The demo sample, kept apart so it can't reach the real numbers above. Always shown labelled."""
    question: str
    metrics: list[MetricTrend]


class ProgressSummary(BaseModel):
    metrics: list[MetricTrend]
    kept: list[KeptHabit]
    # Only until there are real numbers to show.
    example: ProgressExample | None = None


class OutcomeRequest(BaseModel):
    choice: OutcomeChoice


class OutcomeOut(BaseModel):
    experiment_id: str
    choice: OutcomeChoice
