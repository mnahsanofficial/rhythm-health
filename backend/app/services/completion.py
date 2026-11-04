from datetime import UTC, datetime

from app.integrations.supabase import SupabaseConflict
from app.repositories import checkins, experiments, reports
from app.schemas.lab_report import LabReport
from app.schemas.rows import ExperimentRow
from app.services import analysis
from app.services.lab_report import build_lab_report

ALREADY_COMPLETED = "This experiment is already completed"


class CompletionConflict(Exception):
    """The experiment can't be completed as it stands. `detail` is what the person is told."""

    def __init__(self, detail: str | dict) -> None:
        super().__init__(detail)
        self.detail = detail


def ensure_can_complete(row: ExperimentRow) -> None:
    if row["status"] == "completed":
        raise CompletionConflict(ALREADY_COMPLETED)
    if row["status"] != "active":
        raise CompletionConflict("Only an active experiment can be completed")


def complete_experiment(row: ExperimentRow, profile_id: str, experiment_id: str) -> LabReport:
    """Run the deterministic analysis, save the report, and mark the experiment completed.

    Raises SupabaseUnavailable if the database can't be reached.
    """
    logged = checkins.list_for_experiment(experiment_id)
    # Read before writing: a failure here must not save a report that omits an overlap.
    others = [] if row.get("is_seeded") else experiments.list_for_profile(profile_id)

    need_base, need_inter = analysis.required_checkins(row["baseline_days"], row["intervention_days"])
    have_base, have_inter = analysis.checkin_counts(logged)
    if have_base < need_base or have_inter < need_inter:
        raise CompletionConflict({
            "message": "Not enough check-ins to complete this experiment yet",
            "baseline_checkins": have_base,
            "baseline_required": need_base,
            "intervention_checkins": have_inter,
            "intervention_required": need_inter,
        })

    completed_at = datetime.now(UTC)
    result = analysis.analyze(row, logged, completed_at, others)
    try:
        saved = reports.upsert(experiment_id, result.model_dump(mode="json"))
        done = experiments.complete(profile_id, experiment_id, completed_at.isoformat())
    except SupabaseConflict:
        raise CompletionConflict(ALREADY_COMPLETED)
    if done is None:  # lost a race: no longer active
        raise CompletionConflict(ALREADY_COMPLETED)
    return build_lab_report(done, saved, logged)
