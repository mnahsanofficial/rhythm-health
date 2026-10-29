from uuid import UUID

from fastapi import HTTPException

from app.integrations.supabase import SupabaseUnavailable
from app.repositories import experiments, profiles


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


def owned_experiment(user_id: str, experiment_id: UUID) -> dict:
    """The experiment, only if it belongs to the token's user (otherwise 404)."""
    profile_id = profile_id_for(user_id)
    try:
        row = experiments.get(profile_id, str(experiment_id))
    except SupabaseUnavailable:
        raise db_error()
    if row is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return row
