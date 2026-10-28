from fastapi import APIRouter, Depends, HTTPException

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import profiles
from app.schemas.profile import ProfileIn, ProfileOut

router = APIRouter(prefix="/api/profile")


def _db_error() -> HTTPException:
    return HTTPException(status_code=503, detail="Database unavailable")


@router.get("", response_model=ProfileOut)
def get_profile(user_id: str = Depends(get_current_user)):
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise _db_error()
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row


@router.put("", response_model=ProfileOut)
def put_profile(body: ProfileIn, user_id: str = Depends(get_current_user)):
    try:
        return profiles.upsert(user_id, body.model_dump())
    except SupabaseUnavailable:
        raise _db_error()
