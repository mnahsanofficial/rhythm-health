"""Backend-only usage counters. No arbitrary properties; never block the user's action."""
import logging

from app.config import settings
from app.integrations.supabase import rest_request

logger = logging.getLogger(__name__)
EVENTS = (
    "experiment_started", "checkin_saved", "checkin_updated", "baseline_completed",
    "experiment_completed", "report_written", "outcome_chosen", "soft_check_shown", "safety_blocked",
)


def insert(profile_id: str, event_name: str, experiment_id: str | None) -> None:
    if settings.dev_failure_drill and settings.app_environment == "development" and settings.dev_event_write_failure:
        raise RuntimeError("App event failure drill")
    rest_request("POST", "app_events", json={"profile_id": profile_id, "event_name": event_name,
                                            "experiment_id": experiment_id}, prefer="return=minimal")


def record(profile_id: str, event_name: str, experiment_id: str | None = None) -> None:
    try:
        if event_name not in EVENTS:
            raise ValueError("Unknown event")
        insert(str(profile_id), event_name, str(experiment_id) if experiment_id else None)
    except Exception:
        logger.warning("app_event_not_recorded event_name=%s", event_name if event_name in EVENTS else "unknown")


def previous_checkins(experiment_id: str) -> list[dict] | None:
    from app.repositories import checkins
    try:
        return checkins.list_for_experiment(experiment_id)
    except Exception:
        logger.warning("app_event_previous_unavailable")
        return None


def checkin_recorded(profile_id: str, row: dict, day: int, previous: list[dict] | None) -> None:
    """Baseline completes when its final previously missing day is recorded."""
    if previous is None or row.get("is_seeded"):
        return
    recorded = {c["day_number"] for c in previous}
    record(profile_id, "checkin_updated" if day in recorded else "checkin_saved", row["id"])
    baseline = set(range(1, row["baseline_days"] + 1))
    if not baseline <= recorded and baseline <= recorded | {day}:
        record(profile_id, "baseline_completed", row["id"])
