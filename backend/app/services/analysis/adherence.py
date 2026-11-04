from datetime import datetime

from app.schemas.analysis import Adherence
from app.services.analysis.numbers import _r
from app.services.progress import DAY


def adherence_for(
    experiment: dict, checkins: list[dict], observed_at: datetime | None = None
) -> Adherence:
    """One elapsed-day/coverage rule for completion analysis and live progress."""
    return _adherence(
        checkins, experiment["baseline_days"], experiment["intervention_days"],
        _days_elapsed(experiment, observed_at),
    )


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
