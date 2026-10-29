from app.integrations.supabase import rest_request


def upsert(experiment_id: str, analysis: dict) -> dict:
    """Idempotent: analysis is deterministic, so a retry rewrites the same report."""
    rows = rest_request(
        "POST",
        "experiment_reports",
        params={"on_conflict": "experiment_id"},
        json={"experiment_id": experiment_id, "analysis": analysis},
        prefer="resolution=merge-duplicates,return=representation",
    )
    return rows[0]


def get(experiment_id: str) -> dict | None:
    rows = rest_request(
        "GET", "experiment_reports", params={"experiment_id": f"eq.{experiment_id}", "select": "*"}
    )
    return rows[0] if rows else None


def save_narrative(experiment_id: str, columns: dict) -> dict | None:
    """Store the AI-written parts on an existing report. None if there is no report."""
    rows = rest_request(
        "PATCH",
        "experiment_reports",
        params={"experiment_id": f"eq.{experiment_id}"},
        json=columns,
        prefer="return=representation",
    )
    return rows[0] if rows else None
