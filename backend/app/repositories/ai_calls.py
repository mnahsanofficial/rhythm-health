from datetime import datetime

from app.integrations.supabase import rest_request

# ok and invalid each finish one attempt the model was paid for.
COUNTED_STATUSES = ("ok", "invalid")


def insert(profile_id: str, kind: str, model: str, status: str, latency_ms: int) -> None:
    rest_request(
        "POST",
        "ai_calls",
        json={"profile_id": profile_id, "kind": kind, "model": model, "status": status, "latency_ms": latency_ms},
        prefer="return=representation",
    )


def count_since(profile_id: str, kind: str, since: datetime, at_most: int) -> int:
    """Counted calls since `since`. Stops at `at_most`, which is all the limit needs to know."""
    rows = rest_request(
        "GET",
        "ai_calls",
        params={
            "profile_id": f"eq.{profile_id}",
            "kind": f"eq.{kind}",
            "status": f"in.({','.join(COUNTED_STATUSES)})",
            "created_at": f"gte.{since.isoformat()}",
            "select": "id",
            "limit": str(at_most),
        },
    )
    return len(rows)
