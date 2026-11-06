from datetime import UTC, datetime

import pytest

from app.repositories import ai_calls


class FakeAICalls:
    """An in-memory ai_calls table, so no test ever writes to a real database."""

    def __init__(self):
        self.rows: list[dict] = []

    def insert(self, profile_id, kind, model, status, latency_ms):
        self.rows.append({
            "profile_id": profile_id, "kind": kind, "model": model, "status": status,
            "latency_ms": latency_ms, "created_at": datetime.now(UTC),
        })

    def count_since(self, profile_id, kind, since, at_most):
        counted = [
            row for row in self.rows
            if row["profile_id"] == profile_id and row["kind"] == kind
            and row["status"] in ai_calls.COUNTED_STATUSES and row["created_at"] >= since
        ]
        return min(len(counted), at_most)


@pytest.fixture(autouse=True)
def ai_call_rows(monkeypatch):
    fake = FakeAICalls()
    monkeypatch.setattr(ai_calls, "insert", fake.insert)
    monkeypatch.setattr(ai_calls, "count_since", fake.count_since)
    return fake


@pytest.fixture(autouse=True)
def app_event_rows(monkeypatch):
    from app.services import app_events
    rows = []
    monkeypatch.setattr(app_events, "insert", lambda profile_id, event_name, experiment_id: rows.append({
        "profile_id": profile_id, "event_name": event_name, "experiment_id": experiment_id,
    }))
    return rows
