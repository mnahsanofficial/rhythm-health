from app.schemas.experiment import Metric
from app.schemas.progress import BaselineMetric, BaselineSummary
from app.services.analysis.numbers import _numeric


def baseline_summary(experiment: dict, checkins: list[dict]) -> BaselineSummary:
    """Observed normal-day ranges for live context, not a result or a forecast.

    Use the stored phase and recorded values only. No filling missed days, no
    outlier removal, and no minimum sample threshold that would hide sparse data.
    """
    normal = [c for c in checkins if c["phase"] == "baseline"]
    summaries = []
    for raw in experiment.get("metrics", []):
        metric = Metric.model_validate(raw)
        values = [c.get("metric_values", {})[metric.key] for c in normal
                  if metric.key in c.get("metric_values", {})]
        n = len(values)
        item = BaselineMetric(key=metric.key, label=metric.label, n=n,
                              description=f"{metric.label}: no normal-day answers recorded.")
        if n and metric.type == "boolean":
            item.yes_count = sum(values)
            item.description = f"{metric.label}: Yes on {item.yes_count} of {n} recorded normal {'day' if n == 1 else 'days'}."
        elif n:
            item.minimum, item.maximum = min(map(_numeric, values)), max(map(_numeric, values))
            low, high = _plain_number(item.minimum), _plain_number(item.maximum)
            observed = low if item.minimum == item.maximum else f"{low}–{high}"
            unit = " minutes" if metric.type == "duration" else (
                f" out of {_plain_number(metric.max)}" if metric.type == "scale" else ""
            )
            item.description = f"{metric.label}: {observed}{unit} ({n} {'answer' if n == 1 else 'answers'})."
        summaries.append(item)
    return BaselineSummary(days_recorded=len(normal), days_planned=experiment["baseline_days"], metrics=summaries)


def _plain_number(value: float) -> str:
    return str(value).removesuffix(".0")


# --- adherence --------------------------------------------------------------
