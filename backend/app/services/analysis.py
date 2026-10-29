"""Deterministic N-of-1 analysis (TRD 21-23). No LLM, no clinical claims.

All thresholds are named constants below so the behaviour is easy to read and test.
"""

import math
import statistics
from datetime import datetime

from app.schemas.analysis import (
    Adherence,
    Analysis,
    MetricAnalysis,
    Outlier,
    PhaseStats,
    PredictionComparison,
    Signal,
)
from app.schemas.experiment import Metric, SuccessCriteria
from app.schemas.prediction import Prediction
from app.services.progress import DAY

# Minimum check-ins per phase before an experiment can be completed (capped by the
# configured phase length, so the 1 + 2 day demo shape still works).
MIN_BASELINE_CHECKINS = 2
MIN_INTERVENTION_CHECKINS = 3

# Signal classification thresholds.
LIKELY_MIN_INTERVENTION_DAYS = 5
LIKELY_MIN_CONSISTENCY = 0.7
POSSIBLE_MIN_CONSISTENCY = 0.6
NOISE_MAX_CONSISTENCY = 0.5
LOW_ADHERENCE = 0.6
STRONG_EFFECT = 0.8  # |Cohen's d|
WEAK_EFFECT = 0.3
NO_CHANGE_BAND = 5.0  # percent: "no change" predictions are right inside +/- this

# Outlier detection: modified z-score (median/MAD), only with enough points.
OUTLIER_MIN_POINTS = 4
OUTLIER_Z = 3.5


def required_checkins(baseline_days: int, intervention_days: int) -> tuple[int, int]:
    return (
        min(MIN_BASELINE_CHECKINS, baseline_days),
        min(MIN_INTERVENTION_CHECKINS, intervention_days),
    )


def checkin_counts(checkins: list[dict]) -> tuple[int, int]:
    baseline = sum(1 for c in checkins if c["phase"] == "baseline")
    return baseline, len(checkins) - baseline


def analyze(experiment: dict, checkins: list[dict], completed_at: datetime | None = None) -> Analysis:
    metrics = [Metric.model_validate(m) for m in experiment["metrics"]]
    criteria = SuccessCriteria.model_validate(experiment["success_criteria"])
    prediction = Prediction.model_validate(experiment["prediction"])
    baseline_days = experiment["baseline_days"]
    intervention_days = experiment["intervention_days"]

    adherence = _adherence(
        checkins, baseline_days, intervention_days, _days_elapsed(experiment, completed_at)
    )
    results = [_analyze_metric(m, checkins) for m in metrics]
    primary = next(r for r in results if r.primary)

    comparison = _compare_prediction(primary, prediction)
    signal = classify_signal(
        primary,
        predicted_direction=prediction.direction,
        threshold_percent=criteria.minimum_change_percent,
        adherence_rate=adherence.adherence_rate,
    )
    return Analysis(
        primary_metric=primary.key,
        success_criteria_percent=criteria.minimum_change_percent,
        adherence=adherence,
        metrics=results,
        prediction=comparison,
        signal=signal,
    )


# --- adherence --------------------------------------------------------------


def _days_elapsed(experiment: dict, completed_at: datetime | None) -> int | None:
    """Whole 24-hour days finished by `completed_at`, or None to treat every planned day as
    elapsed (no completion time, or an experiment that never started)."""
    started_at = experiment.get("started_at")
    if completed_at is None or started_at is None:
        return None
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at)
    return max(0, (completed_at - started_at) // DAY)


def _adherence(
    checkins: list[dict],
    baseline_days: int,
    intervention_days: int,
    days_elapsed: int | None = None,
) -> Adherence:
    base = [c for c in checkins if c["phase"] == "baseline"]
    inter = [c for c in checkins if c["phase"] == "intervention"]
    completed = sum(1 for c in inter if c["intervention_completed"])
    total = baseline_days + intervention_days
    logged_days = {c["day_number"] for c in checkins}
    # Days that can count as missed: those that finished before completion. A day still in
    # progress counts only if it was logged, and days that never happened count for nothing.
    finished = total if days_elapsed is None else min(total, days_elapsed)
    considered = set(range(1, finished + 1)) | logged_days
    return Adherence(
        baseline_days_planned=baseline_days,
        baseline_days_logged=len(base),
        intervention_days_planned=intervention_days,
        intervention_days_logged=len(inter),
        intervention_days_completed=completed,
        adherence_rate=_r(completed / len(inter)) if inter else None,
        coverage_rate=_r(len(logged_days) / len(considered)) if considered else 0.0,
        missing_days=sorted(considered - logged_days),
    )


# --- per-metric statistics --------------------------------------------------


def _numeric(value: bool | int | float) -> float:
    return float(value)  # booleans become 0/1, so their mean is a rate


def _analyze_metric(metric: Metric, checkins: list[dict]) -> MetricAnalysis:
    series = {
        phase: [
            (c["day_number"], _numeric(c["metric_values"][metric.key]))
            for c in checkins
            if c["phase"] == phase and metric.key in c["metric_values"]
        ]
        for phase in ("baseline", "intervention")
    }
    base_values = [v for _, v in series["baseline"]]
    inter_values = [v for _, v in series["intervention"]]
    base, inter = _stats(base_values), _stats(inter_values)

    result = MetricAnalysis(
        key=metric.key,
        label=metric.label,
        type=metric.type,
        primary=metric.primary,
        baseline=base,
        intervention=inter,
        outliers=_outliers(series),
    )
    if base.mean is None or inter.mean is None:
        return result

    change = inter.mean - base.mean
    result.absolute_change = _r(change)
    if base.mean != 0:
        result.percent_change = _r(change / abs(base.mean) * 100, 2)
        if base.median not in (None, 0) and inter.median is not None:
            result.median_change_percent = _r((inter.median - base.median) / abs(base.median) * 100, 2)

    pooled = _pooled_sd(base, inter)
    result.pooled_sd = _r(pooled) if pooled is not None else None
    if pooled:  # not None and not 0
        result.effect_size = _r(change / pooled, 2)

    # Consistency is about the observed direction, so a strong move against the
    # prediction reads as consistent too (classify_signal decides what that means).
    sign = _sign(change)
    if sign and inter_values:
        agreeing = sum(1 for v in inter_values if sign * (v - base.mean) > 0)
        result.direction_consistency = _r(agreeing / len(inter_values), 2)
    return result


def _stats(values: list[float]) -> PhaseStats:
    if not values:
        return PhaseStats(n=0)
    return PhaseStats(
        n=len(values),
        mean=_r(statistics.fmean(values)),
        median=_r(statistics.median(values)),
        sd=_r(statistics.stdev(values)) if len(values) >= 2 else None,
    )


def _pooled_sd(base: PhaseStats, inter: PhaseStats) -> float | None:
    if base.n < 2 or inter.n < 2 or base.sd is None or inter.sd is None:
        return None
    dof = base.n + inter.n - 2
    return math.sqrt(((base.n - 1) * base.sd**2 + (inter.n - 1) * inter.sd**2) / dof)


def _outliers(series: dict[str, list[tuple[int, float]]]) -> list[Outlier]:
    found: list[Outlier] = []
    for phase, points in series.items():
        if len(points) < OUTLIER_MIN_POINTS:
            continue
        values = [v for _, v in points]
        median = statistics.median(values)
        mad = statistics.median(abs(v - median) for v in values)
        if mad == 0:
            continue
        for day, value in points:
            if abs(0.6745 * (value - median) / mad) > OUTLIER_Z:
                found.append(Outlier(phase=phase, day_number=day, value=value))
    return found


# --- prediction vs observed -------------------------------------------------


def _compare_prediction(primary: MetricAnalysis, prediction: Prediction) -> PredictionComparison | None:
    observed = primary.percent_change
    if observed is None:
        return None
    low, high = prediction.expected_change_min, prediction.expected_change_max
    midpoint = (low + high) / 2
    if prediction.direction == "no_change":
        direction_correct = abs(observed) < NO_CHANGE_BAND
    else:
        direction_correct = _sign(observed) == (1 if prediction.direction == "increase" else -1)
    return PredictionComparison(
        predicted_direction=prediction.direction,
        predicted_min=low,
        predicted_max=high,
        predicted_midpoint=_r(midpoint, 2),
        observed_change_percent=observed,
        error_points=_r(observed - midpoint, 2),
        within_predicted_range=low <= observed <= high,
        direction_correct=direction_correct,
        accuracy_percent=prediction_accuracy(low, high, observed),
    )


def prediction_accuracy(predicted_min: float, predicted_max: float, observed: float) -> float:
    """How close the forecast was to the observed percent change, bounded 0-100.

    error = |observed - midpoint|
    scale = max(|midpoint|, range width, 10)   # 10 points: tolerance floor for tiny predictions
    accuracy = 100 * (1 - error / scale), floored at 0

    Exactly on the midpoint is 100; off by a full scale (e.g. observing no change when
    +12 was predicted) is 0. This is closeness of the forecast, not scientific confidence.
    """
    midpoint = (predicted_min + predicted_max) / 2
    scale = max(abs(midpoint), predicted_max - predicted_min, 10.0)
    return _r(max(0.0, 100 * (1 - abs(observed - midpoint) / scale)), 1)


# --- signal classification (the single place this lives, TRD 22) -------------


def classify_signal(
    primary: MetricAnalysis,
    *,
    predicted_direction: str,
    threshold_percent: float,
    adherence_rate: float | None,
) -> Signal:
    change = primary.percent_change
    if change is None or primary.baseline.n == 0 or primary.intervention.n == 0:
        return Signal(
            classification="unclear",
            reasons=["insufficient_data"],
            success_criteria_met=False,
            matches_predicted_direction=False,
        )

    observed_sign = _sign(change)
    # For "no_change" predictions we still ask whether any real effect showed up.
    expected_sign = {"increase": 1, "decrease": -1}.get(predicted_direction, observed_sign)
    in_direction = observed_sign != 0 and observed_sign == expected_sign
    matches = abs(change) < NO_CHANGE_BAND if predicted_direction == "no_change" else in_direction

    consistency = primary.direction_consistency or 0.0
    effect = primary.effect_size
    noise_free = primary.pooled_sd == 0 and primary.absolute_change not in (None, 0)
    strong_variation = noise_free or (effect is not None and abs(effect) >= STRONG_EFFECT)
    weak_variation = effect is not None and abs(effect) < WEAK_EFFECT
    big_enough = abs(change) >= threshold_percent
    criteria_met = in_direction and big_enough
    low_adherence = adherence_rate is not None and adherence_rate < LOW_ADHERENCE
    few_days = primary.intervention.n < LIKELY_MIN_INTERVENTION_DAYS

    reasons: list[str] = []
    if criteria_met:
        reasons.append("change_meets_success_criteria")
    elif in_direction:
        reasons.append("change_below_success_criteria")
    if consistency >= LIKELY_MIN_CONSISTENCY:
        reasons.append("consistent_direction")
    elif consistency < NOISE_MAX_CONSISTENCY:
        reasons.append("inconsistent_direction")
    if strong_variation:
        reasons.append("larger_than_normal_variation")
    elif weak_variation:
        reasons.append("within_normal_variation")
    if low_adherence:
        reasons.append("low_adherence")
    if few_days:
        reasons.append("few_intervention_days")

    if expected_sign != observed_sign:
        # No movement, or movement against the prediction.
        if observed_sign != 0 and strong_variation and consistency >= LIKELY_MIN_CONSISTENCY:
            reasons.append("moved_opposite_to_prediction")
            cls = "unclear"
        else:
            cls = "probably_noise"
    elif (
        criteria_met
        and consistency >= LIKELY_MIN_CONSISTENCY
        and strong_variation
        and not few_days
        and not low_adherence
    ):
        cls = "likely_signal"
    elif consistency >= POSSIBLE_MIN_CONSISTENCY and (big_enough or strong_variation):
        cls = "possible_signal"
    elif weak_variation or consistency < NOISE_MAX_CONSISTENCY or abs(change) < threshold_percent / 2:
        cls = "probably_noise"
    else:
        cls = "unclear"

    return Signal(
        classification=cls,
        reasons=reasons,
        success_criteria_met=criteria_met,
        matches_predicted_direction=matches,
    )


# --- helpers ----------------------------------------------------------------


def _sign(x: float) -> int:
    return (x > 0) - (x < 0)


def _r(x: float, digits: int = 3) -> float:
    return round(x, digits)
