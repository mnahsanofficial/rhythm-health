from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Literal
from uuid import UUID

from app.repositories import experiments
from app.schemas.experiment import ExperimentOut

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


class SampleRemovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: Literal[True]


class SampleRemovalResult(BaseModel):
    removed: bool


@router.post("/active", response_model=ExperimentOut, status_code=201)
def start_active_sample(body: DemoResetRequest, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)
    try:
        return demo.start_active(profile_id)
    except SupabaseConflict:
        raise HTTPException(status_code=409, detail="You already have an active experiment. Remove the sample or finish your real experiment before starting another.")
    except SupabaseUnavailable:
        raise db_error()


@router.post("/active/{experiment_id}/remove", response_model=SampleRemovalResult)
def remove_active_sample(experiment_id: UUID, body: SampleRemovalRequest, user_id: str = Depends(get_current_user)):
    profile_id = profile_id_for(user_id)
    try:
        row = experiments.get(profile_id, str(experiment_id))
        if row is None or not row["is_seeded"]:
            raise HTTPException(status_code=404, detail="Sample experiment not found")
        experiments.delete_sample(profile_id, str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    return SampleRemovalResult(removed=True)
