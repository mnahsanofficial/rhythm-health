import math
import statistics

from app.schemas.analysis import MetricAnalysis, Outlier, PhaseStats
from app.schemas.experiment import Metric
from app.services.analysis.numbers import _numeric, _r, _sign
from app.services.analysis.thresholds import OUTLIER_MIN_POINTS, OUTLIER_Z


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
