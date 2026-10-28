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


class SupabaseUnavailable(Exception):
    """The Supabase database could not be reached or returned an error."""


class SupabaseConflict(Exception):
    """A uniqueness constraint rejected the write (HTTP 409 from PostgREST)."""


def rest_request(
    method: str,
    table: str,
    *,
    params: dict[str, str] | None = None,
    json: dict | None = None,
    prefer: str | None = None,
) -> list[dict]:
    """Call PostgREST with the service-role key. Callers must scope queries to the user."""
    key = settings.supabase_service_role_key
    if not settings.supabase_url or not key:
        raise SupabaseUnavailable("Supabase is not configured")
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if prefer:
        headers["Prefer"] = prefer
    try:
        res = httpx.request(
            method,
            f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}",
            headers=headers,
            params=params,
            json=json,
            timeout=10,
        )
        res.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            raise SupabaseConflict() from exc
        raise SupabaseUnavailable(type(exc).__name__) from exc
    except httpx.HTTPError as exc:
        raise SupabaseUnavailable(type(exc).__name__) from exc
    return res.json()
