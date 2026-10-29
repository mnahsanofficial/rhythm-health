import math

from app.schemas.experiment import Metric

MAX_NUMBER = 1_000_000
MAX_DURATION_MINUTES = 24 * 60


def validate_metric_values(
    metrics: list[Metric], values: dict[str, bool | int | float]
) -> tuple[dict[str, bool | int | float], list[dict[str, str]]]:
    """Check submitted values against the experiment's own metric definitions.

    Every metric is required and unknown keys are rejected, so each day has the same
    shape for the later analysis. Returns (cleaned values, errors).
    """
    errors: list[dict[str, str]] = []
    cleaned: dict[str, bool | int | float] = {}
    by_key = {m.key: m for m in metrics}

    for key in values:
        if key not in by_key:
            errors.append({"field": key, "message": "Not a metric of this experiment"})

    for metric in metrics:
        if metric.key not in values:
            errors.append({"field": metric.key, "message": "Required"})
            continue
        value = values[metric.key]
        message = _check(metric, value)
        if message:
            errors.append({"field": metric.key, "message": message})
        else:
            cleaned[metric.key] = _normalize(metric, value)
    return cleaned, errors


def _check(metric: Metric, value: bool | int | float) -> str | None:
    is_bool = isinstance(value, bool)
    if metric.type == "boolean":
        return None if is_bool else "Must be true or false"
    if is_bool or not isinstance(value, (int, float)) or not math.isfinite(value):
        return "Must be a number"
    if metric.type == "scale":
        if value != int(value):
            return "Must be a whole number"
        if not metric.min <= value <= metric.max:  # bounds are guaranteed for scale metrics
            return f"Must be between {metric.min:g} and {metric.max:g}"
    elif metric.type == "duration":
        if not 0 <= value <= MAX_DURATION_MINUTES:
            return f"Must be between 0 and {MAX_DURATION_MINUTES} minutes"
    elif abs(value) > MAX_NUMBER:  # number
        return f"Must be between -{MAX_NUMBER} and {MAX_NUMBER}"
    return None


def _normalize(metric: Metric, value: bool | int | float) -> bool | int | float:
    if metric.type == "scale":
        return int(value)  # 7.0 -> 7
    return value
