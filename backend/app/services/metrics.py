"""Read-only seven-day counters, calculated in Python; emits no individual identifiers."""
import json
from collections import Counter
from datetime import UTC, datetime, timedelta

from app.integrations.supabase import rest_request
from app.services.app_events import EVENTS


def _date(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value


def summarize(events: list[dict], experiments: list[dict], checkins: list[dict], now: datetime) -> dict:
    since = now - timedelta(days=7)
    recent = [e for e in events if since <= _date(e["created_at"]) <= now]
    counts = Counter(e["event_name"] for e in recent)
    days = {(now - timedelta(days=d)).date().isoformat(): set() for d in range(7)}
    for event in recent:
        day = _date(event["created_at"]).astimezone(UTC).date().isoformat()
        if day in days:
            days[day].add(event["profile_id"])
    recorded = elapsed = 0
    for row in experiments:
        if row.get("is_seeded") or not row.get("started_at") or row["status"] not in {"active", "completed"}:
            continue
        start = _date(row["started_at"])
        end = min(now, _date(row["completed_at"])) if row.get("completed_at") else now
        eligible = {d for d in range(1, row["baseline_days"] + row["intervention_days"] + 1)
                    if since <= start + timedelta(days=d-1) <= end}
        elapsed += len(eligible)
        recorded += len({c["day_number"] for c in checkins
                         if c["experiment_id"] == row["id"] and c["day_number"] in eligible})
    return {"window_start": since.isoformat(), "window_end": now.isoformat(),
            "counts": {e: counts[e] for e in EVENTS},
            "daily_active_users": {d: len(users) for d, users in sorted(days.items())},
            "checkin_completion": {"days_recorded": recorded, "days_elapsed": elapsed,
                                    "rate": recorded / elapsed if elapsed else None}}


def _all(table: str, params: dict) -> list[dict]:
    rows, offset = [], 0
    while True:
        page = rest_request("GET", table, params={**params, "order": "id.asc", "limit": "500", "offset": str(offset)})
        rows.extend(page)
        if len(page) < 500:
            return rows
        offset += len(page)


def main() -> None:
    now = datetime.now(UTC)
    events = _all("app_events", {"select": "id,profile_id,event_name,created_at", "created_at": f"gte.{(now-timedelta(days=7)).isoformat()}"})
    experiments = _all("experiments", {"select": "id,status,started_at,completed_at,baseline_days,intervention_days,is_seeded", "is_seeded": "eq.false", "started_at": "not.is.null"})
    checkins = _all("daily_checkins", {"select": "id,experiment_id,day_number"})
    print(json.dumps(summarize(events, experiments, checkins, now), indent=2))


if __name__ == "__main__":
    main()
