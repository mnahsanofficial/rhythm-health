from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import db_error, owned_experiment, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations.openrouter import AIInvalidOutput, AIUnavailable
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.repositories import checkins, experiments, profiles, reports
from app.schemas.analysis import Analysis
from app.schemas.lab_report import LabReport
from app.services import analysis
from app.services.lab_report import build_lab_report, narrative_from_row, narrative_to_columns
from app.services.report_writer import write_narrative

router = APIRouter(prefix="/api/experiments/{experiment_id}")


@router.post("/complete", response_model=LabReport)
def complete_experiment(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    """Run the deterministic analysis, save the report, and mark the experiment completed.

    The AI-written part is added afterwards by POST /report, so completing stays fast
    and never depends on the AI service.
    """
    row = owned_experiment(user_id, experiment_id)
    if row["status"] == "completed":
        raise HTTPException(status_code=409, detail="This experiment is already completed")
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail="Only an active experiment can be completed")

    try:
        logged = checkins.list_for_experiment(str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()

    need_base, need_inter = analysis.required_checkins(row["baseline_days"], row["intervention_days"])
    have_base, have_inter = analysis.checkin_counts(logged)
    if have_base < need_base or have_inter < need_inter:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Not enough check-ins to complete this experiment yet",
                "baseline_checkins": have_base,
                "baseline_required": need_base,
                "intervention_checkins": have_inter,
                "intervention_required": need_inter,
            },
        )

    completed_at = datetime.now(UTC)
    result = analysis.analyze(row, logged, completed_at)
    profile_id = profile_id_for(user_id)
    try:
        saved = reports.upsert(str(experiment_id), result.model_dump(mode="json"))
        done = experiments.complete(profile_id, str(experiment_id), completed_at.isoformat())
    except SupabaseConflict:
        raise HTTPException(status_code=409, detail="This experiment is already completed")
    except SupabaseUnavailable:
        raise db_error()
    if done is None:  # lost a race: no longer active
        raise HTTPException(status_code=409, detail="This experiment is already completed")
    return build_lab_report(done, saved, logged)


@router.get("/report", response_model=LabReport)
def get_report(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    """The Lab Report: analysis, chart data, and the written narrative once it exists."""
    row = owned_experiment(user_id, experiment_id)
    try:
        saved = reports.get(str(experiment_id))
        if saved is None:
            raise HTTPException(status_code=404, detail="No report for this experiment yet")
        logged = checkins.list_for_experiment(str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    return build_lab_report(row, saved, logged)


@router.post("/report", response_model=LabReport)
def write_report(
    experiment_id: UUID, regenerate: bool = False, user_id: str = Depends(get_current_user)
):
    """Have the reasoning model explain the stored analysis, and save it on the report.

    Idempotent: if the narrative already exists it is returned without calling the model,
    unless ?regenerate=true. The analysis itself is never touched.
    """
    row = owned_experiment(user_id, experiment_id)
    if row["status"] != "completed":
        raise HTTPException(status_code=409, detail="Complete the experiment before writing its report")

    try:
        saved = reports.get(str(experiment_id))
        if saved is None:
            raise HTTPException(status_code=404, detail="No report for this experiment yet")
        logged = checkins.list_for_experiment(str(experiment_id))
        profile = profiles.get_by_user_id(user_id) or {}
    except SupabaseUnavailable:
        raise db_error()

    if narrative_from_row(saved) is not None and not regenerate:
        return build_lab_report(row, saved, logged)

    try:
        narrative = write_narrative(row, Analysis.model_validate(saved["analysis"]), logged, profile)
    except AIUnavailable:
        raise HTTPException(status_code=503, detail="AI service unavailable, please try again")
    except AIInvalidOutput:
        raise HTTPException(status_code=502, detail="Could not write the report, please try again")

    try:
        updated = reports.save_narrative(str(experiment_id), narrative_to_columns(narrative))
    except SupabaseUnavailable:
        raise db_error()
    return build_lab_report(row, updated or saved, logged)
