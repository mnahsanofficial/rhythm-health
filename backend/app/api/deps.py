from fastapi import HTTPException

from app.integrations.supabase import SupabaseUnavailable
from app.repositories import profiles


def db_error() -> HTTPException:
    return HTTPException(status_code=503, detail="Database unavailable")


def profile_id_for(user_id: str) -> str:
    """The profile that belongs to the token's user. Clients never send this."""
    try:
        row = profiles.get_by_user_id(user_id)
    except SupabaseUnavailable:
        raise db_error()
    if row is None:
        raise HTTPException(status_code=409, detail="Create your profile first")
    return row["id"]
