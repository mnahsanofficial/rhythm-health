from fastapi import APIRouter, Depends, HTTPException

from app.auth.supabase import get_current_user
from app.integrations.openrouter import AIInvalidOutput, AIUnavailable
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import profiles
from app.schemas.experiment import ProposeRequest
from app.schemas.profile import ProfileOut
from app.services.proposal import ProposeResponse, propose

router = APIRouter(prefix="/api/experiments")


@router.post("/propose", response_model=ProposeResponse)
def propose_experiment(body: ProposeRequest, user_id: str = Depends(get_current_user)):
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if row is None:
        raise HTTPException(status_code=409, detail="Create your profile first")

    try:
        return propose(body.question, ProfileOut.model_validate(row))
    except AIUnavailable:
        raise HTTPException(status_code=503, detail="AI service unavailable, please try again")
    except AIInvalidOutput:
        raise HTTPException(status_code=502, detail="Could not generate a valid experiment, please try again")
