from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import db_error, owned_experiment, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations.openrouter import AIInvalidOutput, AIUnavailable
from app.integrations.supabase import PersonalGuessUnavailable, SupabaseConflict, SupabaseUnavailable
from app.repositories import checkins, experiments, profiles
from app.schemas.experiment import ExperimentOut, ExperimentStatus, ProposeRequest
from app.schemas.profile import ProfileOut
from app.schemas.proposal import SaveExperimentRequest
from app.schemas.progress import ExperimentTimeline
from app.services import safety
from app.services.progress import with_progress
from app.services.proposal import ProposeResponse, propose
from app.services.timeline import experiment_timeline

router = APIRouter(prefix="/api/experiments")


@router.post("/propose", response_model=ProposeResponse)
def propose_experiment(body: ProposeRequest, user_id: str = Depends(get_current_user)):
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise db_error()
    if row is None:
        raise HTTPException(status_code=409, detail="Create your profile first")

    try:
        available = experiments.supports_personal_guess(str(row["id"]))
        result = propose(body.question, ProfileOut.model_validate(row))
        return result.model_copy(update={"personal_guess_available": available})
    except SupabaseUnavailable:
        raise db_error()
    except AIUnavailable:
        raise HTTPException(status_code=503, detail="AI service unavailable, please try again")
    except AIInvalidOutput:
        raise HTTPException(status_code=502, detail="Could not generate a valid experiment, please try again")


@router.post("", response_model=ExperimentOut, status_code=201)
def save_experiment(body: SaveExperimentRequest, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)

    # The body came back through the client, so it is re-validated (by the schema) and
    # re-checked for safety rather than trusted.
    decision = safety.check_text(body.proposal.model_dump_json())
    if not decision.allowed:
        raise HTTPException(status_code=422, detail=decision.reason)

    proposal = body.proposal
    values = {
        "status": "proposed",
        "question": proposal.question,
        "category": body.category,
        "hypothesis": proposal.hypothesis,
        "intervention": proposal.intervention.model_dump(),
        "baseline_days": proposal.baseline_days,
        "intervention_days": proposal.intervention_days,
        "metrics": [m.model_dump() for m in proposal.metrics],
        "success_criteria": proposal.success_criteria.model_dump(),
        "prediction": body.prediction.model_dump(),
    }
    # Omit the new column entirely for old clients/databases (including explicit null).
    if body.personal_guess_percent is not None:
        values["personal_guess_percent"] = body.personal_guess_percent
    try:
        return with_progress(experiments.create(profile_id, values))
    except PersonalGuessUnavailable:
        raise HTTPException(status_code=409, detail={
            "code": "personal_guess_unavailable",
            "message": "Your guess could not be saved yet. Retry, or explicitly continue without saving your guess. No experiment was saved.",
        })
    except SupabaseUnavailable:
        raise db_error()


@router.get("", response_model=list[ExperimentOut])
def list_experiments(status: ExperimentStatus | None = None, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)
    try:
        return [with_progress(r) for r in experiments.list_for_profile(profile_id, status)]
    except SupabaseUnavailable:
        raise db_error()


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)
    try:
        row = experiments.get(profile_id, str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    if row is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return with_progress(row)


@router.get("/{experiment_id}/progress", response_model=ExperimentTimeline)
def get_progress(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    try:
        row = owned_experiment(user_id, experiment_id)
    except HTTPException as error:
        if error.status_code == 409:  # No profile means no experiment can belong to this user.
            raise HTTPException(status_code=404, detail="Experiment not found") from error
        raise
    try:
        logged = checkins.list_for_experiment(str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    return experiment_timeline(row, logged, datetime.now(UTC))


@router.post("/{experiment_id}/start", response_model=ExperimentOut)
def start_experiment(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)
    already_active = HTTPException(
        status_code=409, detail="You already have an active experiment"
    )
    try:
        row = experiments.get(profile_id, str(experiment_id))
        if row is None:
            raise HTTPException(status_code=404, detail="Experiment not found")
        if row["status"] != "proposed":
            raise HTTPException(
                status_code=409, detail=f"Only a proposed experiment can be started (this one is {row['status']})"
            )
        if experiments.list_for_profile(profile_id, "active"):
            raise already_active
        started = experiments.start(profile_id, str(experiment_id), datetime.now(UTC).isoformat())
    except SupabaseConflict:
        raise already_active
    except SupabaseUnavailable:
        raise db_error()
    if started is None:  # lost a race: no longer proposed
        raise HTTPException(status_code=409, detail="Experiment is no longer proposed")
    return with_progress(started)
