from app.integrations.supabase import rest_request


def upsert(experiment_id: str, day_number: int, values: dict) -> dict:
    """Create or replace this experiment day's check-in (unique per experiment and day)."""
    rows = rest_request(
        "POST",
        "daily_checkins",
        params={"on_conflict": "experiment_id,day_number"},
        json={**values, "experiment_id": experiment_id, "day_number": day_number},
        prefer="resolution=merge-duplicates,return=representation",
    )
    return rows[0]


def list_for_experiment(experiment_id: str) -> list[dict]:
    return rest_request(
        "GET",
        "daily_checkins",
        params={
            "experiment_id": f"eq.{experiment_id}",
            "select": "*",
            "order": "day_number.asc",
        },
    )


def create_many(experiment_id: str, rows: list[dict]) -> list[dict]:
    """Insert a whole run of check-ins in one request (used by the seeded demo)."""
    return rest_request(
        "POST",
        "daily_checkins",
        json=[{**r, "experiment_id": experiment_id} for r in rows],
        prefer="return=representation",
    )
