from fastapi import APIRouter, Depends

from app.auth.supabase import get_current_user

router = APIRouter(prefix="/api")


@router.get("/me")
def me(user_id: str = Depends(get_current_user)) -> dict[str, str]:
    """Protected test endpoint: echoes the user id from the verified token."""
    return {"user_id": user_id}
