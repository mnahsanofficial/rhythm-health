from app.integrations.supabase import rest_request


def create(profile_id: str, values: dict) -> dict:
    rows = rest_request(
        "POST",
        "experiments",
        json={**values, "profile_id": profile_id},
        prefer="return=representation",
    )
    return rows[0]


def list_for_profile(profile_id: str, status: str | None = None) -> list[dict]:
    params = {"profile_id": f"eq.{profile_id}", "select": "*", "order": "created_at.desc"}
    if status:
        params["status"] = f"eq.{status}"
    return rest_request("GET", "experiments", params=params)


def get(profile_id: str, experiment_id: str) -> dict | None:
    """Scoped to the profile, so another user's experiment looks the same as a missing one."""
    rows = rest_request(
        "GET",
        "experiments",
        params={"id": f"eq.{experiment_id}", "profile_id": f"eq.{profile_id}", "select": "*"},
    )
    return rows[0] if rows else None


def start(profile_id: str, experiment_id: str, started_at: str) -> dict | None:
    """Move proposed -> active. The status filter makes the transition atomic:
    None means the experiment was no longer proposed. May raise SupabaseConflict if
    the profile already has an active experiment (partial unique index)."""
    rows = rest_request(
        "PATCH",
        "experiments",
        params={
            "id": f"eq.{experiment_id}",
            "profile_id": f"eq.{profile_id}",
            "status": "eq.proposed",
        },
        json={"status": "active", "started_at": started_at},
        prefer="return=representation",
    )
    return rows[0] if rows else None
