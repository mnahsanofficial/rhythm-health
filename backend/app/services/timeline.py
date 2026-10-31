"""Authoritative day states; delegates day boundaries and missed-day rules."""
from datetime import UTC, datetime

from app.schemas.progress import ExperimentDay, ExperimentTimeline
from app.services.analysis import adherence_for, baseline_summary
from app.services.progress import DAY, with_progress


def experiment_timeline(row: dict, checkins: list[dict], now: datetime) -> ExperimentTimeline:
    progress = with_progress(row, now)["progress"]
    completed = progress.state == "completed"
    observed_at = row.get("completed_at") if completed else now
    if isinstance(observed_at, str):
        observed_at = datetime.fromisoformat(observed_at)
    logged = {c["day_number"] for c in checkins}
    missed = set() if progress.state == "not_started" else set(
        adherence_for(row, checkins, observed_at).missing_days
    )
    days = []
    for day in range(1, progress.total_days + 1):
        state = (
            "recorded" if day in logged else
            "missed" if day in missed else
            "not_observed" if completed else
            "current" if day == progress.day_number else "future"
        )
        days.append(ExperimentDay(
            day_number=day,
            phase="baseline" if day <= row["baseline_days"] else "test",
            state=state,
        ))
    next_day_at = None
    if progress.state == "in_progress" and progress.day_number < progress.total_days:
        # Normalize before adding so even an aware ZoneInfo clock follows elapsed UTC hours.
        next_day_at = progress.started_at.astimezone(UTC) + progress.day_number * DAY
    return ExperimentTimeline(
        progress=progress,
        next_day_at=next_day_at,
        recorded_days=sum(d.state == "recorded" for d in days),
        missed_days=sum(d.state == "missed" for d in days),
        remaining_days=sum(d.state in {"current", "future"} for d in days),
        days=days,
        baseline_summary=baseline_summary(row, checkins) if (
            progress.state == "in_progress" and progress.phase == "intervention"
        ) else None,
    )
