from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth.supabase import get_current_user
from app.integrations.openrouter import AIInvalidOutput, AIUnavailable
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import experiments, profiles
from app.schemas.experiment import ExperimentOut, ExperimentStatus, ProposeRequest
from app.schemas.profile import ProfileOut
from app.schemas.proposal import SaveExperimentRequest
from app.services import safety
from app.services.proposal import ProposeResponse, propose

router = APIRouter(prefix="/api/experiments")


def _db_error() -> HTTPException:
    return HTTPException(status_code=503, detail="Database unavailable")


def _profile_id(user_id: str) -> str:
    """The profile that belongs to the token's user. Clients never send this."""
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise _db_error()
    if row is None:
        raise HTTPException(status_code=409, detail="Create your profile first")
    return row["id"]


@router.post("/propose", response_model=ProposeResponse)
def propose_experiment(body: ProposeRequest, user_id: str = Depends(get_current_user)):
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise _db_error()
    if row is None:
        raise HTTPException(status_code=409, detail="Create your profile first")

    try:
        return propose(body.question, ProfileOut.model_validate(row))
    except AIUnavailable:
        raise HTTPException(status_code=503, detail="AI service unavailable, please try again")
    except AIInvalidOutput:
        raise HTTPException(status_code=502, detail="Could not generate a valid experiment, please try again")


@router.post("", response_model=ExperimentOut, status_code=201)
def save_experiment(body: SaveExperimentRequest, user_id: str = Depends(get_current_user)):
    profile_id = _profile_id(user_id)

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
    try:
        return experiments.create(profile_id, values)
    except SupabaseUnavailable:
        raise _db_error()


@router.get("", response_model=list[ExperimentOut])
def list_experiments(status: ExperimentStatus | None = None, user_id: str = Depends(get_current_user)):
    profile_id = _profile_id(user_id)
    try:
        return experiments.list_for_profile(profile_id, status)
    except SupabaseUnavailable:
        raise _db_error()


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: UUID, user_id: str = Depends(get_current_user)):
    profile_id = _profile_id(user_id)
    try:
        row = experiments.get(profile_id, str(experiment_id))
    except SupabaseUnavailable:
        raise _db_error()
    if row is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return row
