from app.integrations.supabase import rest_request


def get_by_user_id(user_id: str) -> dict | None:
    rows = rest_request(
        "GET", "profiles", params={"user_id": f"eq.{user_id}", "select": "*"}
    )
    return rows[0] if rows else None


def upsert(user_id: str, values: dict) -> dict:
    """Create or update the profile for this user (user_id is unique)."""
    rows = rest_request(
        "POST",
        "profiles",
        params={"on_conflict": "user_id"},
        json={**values, "user_id": user_id},
        prefer="resolution=merge-duplicates,return=representation",
    )
    return rows[0]
