from datetime import UTC, datetime, timedelta

from app.schemas.progress import ExperimentProgress

DAY = timedelta(hours=24)


def compute_progress(
    *,
    status: str,
    started_at: datetime | None,
    baseline_days: int,
    intervention_days: int,
    now: datetime,
) -> ExperimentProgress:
    """Day and phase from the configured durations.

    Days are rolling 24-hour periods counted from `started_at`: day 1 is the first 24h,
    days 1..baseline_days are baseline, the following intervention_days are intervention.
    """
    total = baseline_days + intervention_days
    base = {"total_days": total, "started_at": started_at}

    if status == "completed":
        return ExperimentProgress(state="completed", **base)
    if status != "active" or started_at is None:
        return ExperimentProgress(state="not_started", **base)

    ends_at = started_at + total * DAY
    base["ends_at"] = ends_at
    if now >= ends_at:
        return ExperimentProgress(state="ended", days_remaining=0, **base)

    day = max(0, (now - started_at) // DAY) + 1  # a slightly early clock still counts as day 1
    if day <= baseline_days:
        phase, phase_day, phase_days = "baseline", day, baseline_days
    else:
        phase, phase_day, phase_days = "intervention", day - baseline_days, intervention_days
    return ExperimentProgress(
        state="in_progress",
        day_number=day,
        phase=phase,
        phase_day=phase_day,
        phase_days=phase_days,
        days_remaining=total - day,
        **base,
    )


def with_progress(row: dict, now: datetime | None = None) -> dict:
    """Attach computed progress to a database row for ExperimentOut."""
    started_at = row.get("started_at")
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at)
    progress = compute_progress(
        status=row["status"],
        started_at=started_at,
        baseline_days=row["baseline_days"],
        intervention_days=row["intervention_days"],
        now=now or datetime.now(UTC),
    )
    return {**row, "progress": progress}
