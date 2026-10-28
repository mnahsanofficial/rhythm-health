import httpx

from app.config import settings


def check_connection() -> bool:
    """Reach the project's PostgREST (database) API with the service-role key."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return False
    try:
        res = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            timeout=5,
        )
    except httpx.HTTPError:
        return False
    return res.status_code == 200
