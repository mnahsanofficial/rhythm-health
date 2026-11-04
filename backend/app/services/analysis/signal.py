from app.schemas.analysis import MetricAnalysis, Signal
from app.services.analysis.numbers import _sign
from app.services.analysis.thresholds import (
    LIKELY_MIN_INTERVENTION_DAYS,
    LIKELY_MIN_CONSISTENCY,
    POSSIBLE_MIN_CONSISTENCY,
    NOISE_MAX_CONSISTENCY,
    LOW_ADHERENCE,
    STRONG_EFFECT,
    WEAK_EFFECT,
    NO_CHANGE_BAND,
)


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
