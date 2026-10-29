from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import db_error, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import checkins, experiments
from app.schemas.checkin import CheckinIn, CheckinOut
from app.schemas.experiment import Metric
from app.services.checkins import validate_metric_values
from app.services.progress import with_progress

router = APIRouter(prefix="/api/experiments/{experiment_id}/checkins")


def _owned_experiment(user_id: str, experiment_id: UUID) -> dict:
    """The experiment, only if it belongs to the token's user (otherwise 404)."""
    profile_id = profile_id_for(user_id)
    try:
        row = experiments.get(profile_id, str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    if row is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return row


@router.post("", response_model=CheckinOut)
def submit_checkin(
    experiment_id: UUID, body: CheckinIn, user_id: str = Depends(get_current_user)
):
    """Submit today's check-in, or replace it if one already exists for today."""
    row = with_progress(_owned_experiment(user_id, experiment_id))
    progress = row["progress"]

    if row["status"] == "completed":
        raise HTTPException(status_code=409, detail="This experiment is completed")
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail="Start the experiment before checking in")
    if progress.state != "in_progress":
        raise HTTPException(status_code=409, detail="The experiment's days are over")

    metrics = [Metric.model_validate(m) for m in row["metrics"]]
    cleaned, errors = validate_metric_values(metrics, body.metric_values)

    if progress.phase == "intervention":
        if body.intervention_completed is None:
            errors.append({"field": "intervention_completed", "message": "Required during the intervention phase"})
        completed = bool(body.intervention_completed)
    else:
        if body.intervention_completed:
            errors.append({"field": "intervention_completed", "message": "The intervention starts after the baseline phase"})
        completed = False
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    try:
        return checkins.upsert(
            str(experiment_id),
            progress.day_number,
            {
                "phase": progress.phase,
                "intervention_completed": completed,
                "metric_values": cleaned,
                "note": body.note or None,
            },
        )
    except SupabaseUnavailable:
        raise db_error()


@router.get("", response_model=list[CheckinOut])
def list_checkins(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    """All check-ins for an owned experiment, oldest day first."""
    _owned_experiment(user_id, experiment_id)
    try:
        return checkins.list_for_experiment(str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
