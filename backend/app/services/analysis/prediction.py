from app.schemas.analysis import MetricAnalysis, PredictionComparison
from app.schemas.prediction import Prediction
from app.services.analysis.numbers import _r, _sign
from app.services.analysis.thresholds import NO_CHANGE_BAND


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
