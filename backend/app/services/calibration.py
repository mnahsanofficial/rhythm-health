"""How close someone's own guesses were to their results. No AI call, and no stored state."""
from statistics import fmean

from pydantic import ValidationError

from app.repositories import experiments, reports
from app.schemas.analysis import PersonalGuessComparison
from app.schemas.calibration import Calibration, CalibrationPoint

# How many recent finished experiments are compared.
MAX_EXPERIMENTS = 20
# A change this small, in percentage points, is too small to call closer or further.
STEADY_BAND = 2.0


def load(profile_id: str) -> Calibration:
    """Raises SupabaseUnavailable if the database can't be reached."""
    rows = experiments.list_completed(profile_id, MAX_EXPERIMENTS)  # Sample experiments are left out.
    analyses = {
        report["experiment_id"]: report["analysis"]
        for report in reports.list_for_experiments([row["id"] for row in rows])
    }
    points = [
        point
        for row in reversed(rows)  # The list is newest first.
        if (point := _point(row, analyses.get(row["id"]))) is not None
    ]
    return Calibration(
        points=points,
        average_off_by_points=round(fmean(p.off_by_points for p in points), 1) if points else None,
        trend=_trend([p.off_by_points for p in points]),
    )


def _point(row: dict, analysis: dict | None) -> CalibrationPoint | None:
    """None when there was no guess, no measurable result, or the report is in an older shape."""
    raw = (analysis or {}).get("personal_guess")
    if raw is None:
        return None
    try:
        guess = PersonalGuessComparison.model_validate(raw)
    except ValidationError:
        return None
    if guess.observed_change_percent is None:
        return None
    return CalibrationPoint(
        experiment_id=row["id"],
        question=row["question"],
        completed_at=row.get("completed_at"),
        guessed_change_percent=guess.guessed_change_percent,
        observed_change_percent=guess.observed_change_percent,
        off_by_points=round(abs(guess.observed_change_percent - guess.guessed_change_percent), 1),
    )


def _trend(gaps: list[float]) -> str | None:
    """Earlier half against later half. With an odd count, the middle guess isn't compared."""
    if len(gaps) < 2:
        return None
    half = len(gaps) // 2
    change = fmean(gaps[-half:]) - fmean(gaps[:half])
    if abs(change) <= STEADY_BAND:
        return "steady"
    return "closer" if change < 0 else "further"
