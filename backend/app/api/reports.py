from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import db_error, owned_experiment, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations import ai_usage
from app.integrations.openrouter import AIInvalidOutput, AIUnavailable
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import checkins, profiles, reports
from app.schemas.analysis import Analysis
from app.schemas.lab_report import LabReport
from app.services import ai_limit, completion
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
    try:
        completion.ensure_can_complete(row)
        return completion.complete_experiment(row, profile_id_for(user_id), str(experiment_id))
    except completion.CompletionConflict as conflict:
        raise HTTPException(status_code=409, detail=conflict.detail)
    except SupabaseUnavailable:
        raise db_error()


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
    if row.get("is_seeded"):
        raise HTTPException(status_code=409, detail="Samples use a fixed report and never call AI. Remove the sample to start a real experiment.")
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

    profile_id = str(profile["id"])
    ai_limit.ensure_within_daily_limit(profile_id, "report")
    try:
        with ai_usage.for_profile(profile_id):
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
