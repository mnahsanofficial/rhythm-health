from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import db_error, owned_experiment, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.repositories import checkins, experiments, reports
from app.schemas.report import CompleteResponse, ReportOut
from app.services import analysis
from app.services.progress import with_progress

router = APIRouter(prefix="/api/experiments/{experiment_id}")


@router.post("/complete", response_model=CompleteResponse)
def complete_experiment(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    """Run the deterministic analysis, save the report, and mark the experiment completed."""
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

    result = analysis.analyze(row, logged)
    profile_id = profile_id_for(user_id)
    try:
        saved = reports.upsert(str(experiment_id), result.model_dump(mode="json"))
        done = experiments.complete(profile_id, str(experiment_id), datetime.now(UTC).isoformat())
    except SupabaseConflict:
        raise HTTPException(status_code=409, detail="This experiment is already completed")
    except SupabaseUnavailable:
        raise db_error()
    if done is None:  # lost a race: no longer active
        raise HTTPException(status_code=409, detail="This experiment is already completed")
    return {"experiment": with_progress(done), "report": saved}


@router.get("/report", response_model=ReportOut)
def get_report(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    owned_experiment(user_id, experiment_id)
    try:
        saved = reports.get(str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    if saved is None:
        raise HTTPException(status_code=404, detail="No report for this experiment yet")
    return saved
