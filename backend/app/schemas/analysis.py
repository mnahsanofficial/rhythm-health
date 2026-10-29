from typing import Literal

from pydantic import BaseModel

SignalClass = Literal["likely_signal", "possible_signal", "unclear", "probably_noise"]


class PhaseStats(BaseModel):
    n: int
    mean: float | None = None
    median: float | None = None
    sd: float | None = None  # sample standard deviation; needs n >= 2


class Outlier(BaseModel):
    phase: Literal["baseline", "intervention"]
    day_number: int
    value: float


class MetricAnalysis(BaseModel):
    key: str
    label: str
    type: str
    primary: bool
    baseline: PhaseStats
    intervention: PhaseStats
    absolute_change: float | None = None  # intervention mean - baseline mean
    percent_change: float | None = None  # relative to the baseline mean
    median_change_percent: float | None = None
    pooled_sd: float | None = None
    # Signed Cohen's d: change in units of normal day-to-day variation.
    effect_size: float | None = None
    # Share of intervention days on the same side of the baseline mean as the observed
    # change. None when there is no change.
    direction_consistency: float | None = None
    outliers: list[Outlier] = []


class Adherence(BaseModel):
    baseline_days_planned: int
    baseline_days_logged: int
    intervention_days_planned: int
    intervention_days_logged: int
    intervention_days_completed: int
    # completed / logged intervention days (None if none logged)
    adherence_rate: float | None = None
    # logged days / days that had elapsed at completion (all planned days for a full run)
    coverage_rate: float
    missing_days: list[int]


class PredictionComparison(BaseModel):
    predicted_direction: Literal["increase", "decrease", "no_change"]
    predicted_min: float
    predicted_max: float
    predicted_midpoint: float
    observed_change_percent: float
    # observed - midpoint, in percentage points
    error_points: float
    within_predicted_range: bool
    direction_correct: bool
    # 0-100: how close the forecast was. Not scientific confidence.
    accuracy_percent: float


class Signal(BaseModel):
    classification: SignalClass
    # Machine-readable facts behind the classification, for later explanation.
    reasons: list[str]
    success_criteria_met: bool
    matches_predicted_direction: bool


class Analysis(BaseModel):
    primary_metric: str
    success_criteria_percent: float
    adherence: Adherence
    metrics: list[MetricAnalysis]
    prediction: PredictionComparison | None = None
    signal: Signal
