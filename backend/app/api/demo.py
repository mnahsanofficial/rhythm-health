from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.api.deps import db_error, profile_id_for
from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.schemas.lab_report import LabReport
from app.services import demo

router = APIRouter(prefix="/api/demo")


class DemoResetRequest(BaseModel):
    """Empty on purpose: the user comes from the verified token, never from the body."""

    model_config = ConfigDict(extra="forbid")


@router.post("/reset", response_model=LabReport)
def reset_demo(
    body: DemoResetRequest | None = None, user_id: str = Depends(get_current_user)
):
    """Create or reset the signed-in user's seeded demo experiment and return its Lab Report."""
    profile_id = profile_id_for(user_id)
    try:
        return demo.reset(profile_id)
    except SupabaseConflict:
        # Two resets raced; the other one is writing the same demo.
        raise HTTPException(status_code=409, detail="The demo is already being reset, try again")
    except SupabaseUnavailable:
        raise db_error()
