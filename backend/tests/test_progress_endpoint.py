"""Authoritative day states, without Supabase writes or paid model calls."""
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api import experiments as routes
from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"
EXP_ID = "11111111-1111-1111-1111-111111111111"
START = datetime(2026, 10, 31, 16, tzinfo=UTC)
URL = f"/api/experiments/{EXP_ID}/progress"
client = TestClient(app)


class FakeDb:
    def __init__(self):
        self.current = ALICE
        self.now = START
        self.row = {
            "id": EXP_ID, "profile_id": f"profile-of-{ALICE}", "status": "active",
            "baseline_days": 3, "intervention_days": 7,
            "started_at": START.isoformat(), "completed_at": None,
        }
        self.logged = []

    def record(self, *days):
        self.logged = [{
            "day_number": day, "phase": "baseline" if day <= 3 else "intervention",
            "intervention_completed": day > 3,
        } for day in days]


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", lambda user: {"id": f"profile-of-{user}"})
    monkeypatch.setattr(experiments, "get", lambda profile, exp: fake.row if (
        profile == fake.row["profile_id"] and exp == EXP_ID
    ) else None)
    monkeypatch.setattr(checkins, "list_for_experiment", lambda exp: fake.logged)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return fake.now.astimezone(tz)

    monkeypatch.setattr(routes, "datetime", Clock)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


def body():
    response = client.get(URL)
    assert response.status_code == 200, response.text
    return response.json()


def test_requires_authentication():
    assert client.get(URL).status_code == 401


@pytest.mark.parametrize("other", [True, False])
def test_other_users_experiment_and_missing_experiment_are_both_404(db, other):
    if other:
        db.current = BOB
        url = URL
    else:
        url = URL.replace(EXP_ID, "22222222-2222-2222-2222-222222222222")
    response = client.get(url)
    assert response.status_code == 404
    assert response.json() == {"detail": "Experiment not found"}


def test_first_day_and_configured_phase_lengths(db):
    db.row.update(baseline_days=1, intervention_days=2)
    result = body()
    assert result["progress"]["day_number"] == 1
    assert result["days"] == [
        {"day_number": 1, "phase": "baseline", "state": "current"},
        {"day_number": 2, "phase": "test", "state": "future"},
        {"day_number": 3, "phase": "test", "state": "future"},
    ]
    assert (result["recorded_days"], result["missed_days"], result["remaining_days"]) == (0, 0, 3)
    assert datetime.fromisoformat(result["next_day_at"]) == START + timedelta(hours=24)


def test_recorded_current_and_missed_past_days(db):
    db.now += timedelta(days=3, hours=2)
    db.record(1, 3, 4)
    result = body()
    assert [d["state"] for d in result["days"]] == [
        "recorded", "missed", "recorded", "recorded", *(["future"] * 6),
    ]
    assert result["days"][3]["phase"] == "test"
    assert (result["recorded_days"], result["missed_days"], result["remaining_days"]) == (3, 1, 6)
    assert result["progress"]["phase_day"] == 1


@pytest.mark.parametrize("timezone", ["Asia/Dhaka", "America/Toronto"])
@pytest.mark.parametrize("hours,day", [(23, 1), (24, 2), (25, 2), (48, 3), (216, 10)])
def test_rolling_24_hours_across_toronto_november_1_dst(db, timezone, hours, day):
    # Toronto rolls back at 06:00 UTC Nov 1. A day is still exactly 24 hours,
    # even when started_at carries an offset and the observer uses another zone.
    db.row["started_at"] = START.astimezone(ZoneInfo(timezone)).isoformat()
    db.now = (START + timedelta(hours=hours)).astimezone(ZoneInfo(timezone))
    result = body()
    assert result["progress"]["day_number"] == day
    assert [d["state"] for d in result["days"]] == (
        ["missed"] * (day - 1) + ["current"] + ["future"] * (10 - day)
    )
    next_at = result["next_day_at"]
    if day == 10:
        assert next_at is None
    else:
        assert datetime.fromisoformat(next_at) == START + timedelta(days=day)


def test_ended_has_no_current_or_future_days(db):
    db.now += timedelta(days=10)
    db.record(1, 10)
    result = body()
    assert result["progress"]["state"] == "ended"
    assert (result["recorded_days"], result["missed_days"], result["remaining_days"]) == (2, 8, 0)
    assert result["next_day_at"] is None
    assert {d["state"] for d in result["days"]} == {"recorded", "missed"}


@pytest.mark.parametrize("record_current", [False, True])
def test_early_completion_never_counts_unobserved_days_as_missed(db, record_current):
    db.row.update(status="completed", completed_at=(START + timedelta(days=6, hours=1)).isoformat())
    db.now += timedelta(days=30)  # Later reads cannot manufacture additional missed days.
    db.record(1, 3, 4, 5, 6, *([7] if record_current else []))
    result = body()
    assert result["progress"]["state"] == "completed"
    assert [d["state"] for d in result["days"]] == [
        "recorded", "missed", "recorded", "recorded", "recorded", "recorded",
        "recorded" if record_current else "not_observed",
        "not_observed", "not_observed", "not_observed",
    ]
    assert result["missed_days"] == 1
    assert result["remaining_days"] == 0
    assert result["next_day_at"] is None


@pytest.mark.parametrize("status", ["draft", "proposed"])
def test_not_started_days_are_future_and_not_missed(db, status):
    db.row.update(status=status, started_at=None)
    result = body()
    assert result["progress"]["state"] == "not_started"
    assert result["remaining_days"] == 10
    assert result["missed_days"] == result["recorded_days"] == 0
    assert result["next_day_at"] is None
    assert {d["state"] for d in result["days"]} == {"future"}


@pytest.mark.parametrize("repository,name", [(profiles, "get_by_user_id"), (experiments, "get"), (checkins, "list_for_experiment")])
def test_database_failure_is_503(db, monkeypatch, repository, name):
    def unavailable(*args):
        raise SupabaseUnavailable("offline")

    monkeypatch.setattr(repository, name, unavailable)
    assert client.get(URL).status_code == 503


def test_invalid_id_is_422(db):
    assert client.get("/api/experiments/not-a-uuid/progress").status_code == 422


def test_user_without_a_profile_cannot_distinguish_unowned_or_missing_ids(db, monkeypatch):
    monkeypatch.setattr(profiles, "get_by_user_id", lambda user: None)
    for experiment_id in [EXP_ID, "22222222-2222-2222-2222-222222222222"]:
        response = client.get(f"/api/experiments/{experiment_id}/progress")
        assert response.status_code == 404
        assert response.json() == {"detail": "Experiment not found"}
