from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles
from app.schemas.experiment import Metric
from app.services.checkins import validate_metric_values
from tests.test_propose import PROPOSAL

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"
EXP_ID = "11111111-1111-1111-1111-111111111111"

METRICS = [
    {"key": "morning_energy", "label": "Morning energy", "type": "scale", "min": 1, "max": 10, "primary": True},
    {"key": "sleep_quality", "label": "Sleep quality", "type": "scale", "min": 1, "max": 10, "primary": False},
    {"key": "minutes_to_sleep", "label": "Minutes to fall asleep", "type": "duration", "min": None, "max": None, "primary": False},
    {"key": "awakenings", "label": "Awakenings", "type": "number", "min": None, "max": None, "primary": False},
    {"key": "late_caffeine", "label": "Caffeine after 2 PM", "type": "boolean", "min": None, "max": None, "primary": False},
]
VALUES = {
    "morning_energy": 7,
    "sleep_quality": 6,
    "minutes_to_sleep": 20,
    "awakenings": 1,
    "late_caffeine": False,
}
BODY = {"intervention_completed": True, "metric_values": VALUES, "note": "late meeting"}


def experiment_row(started_ago: timedelta, status="active", owner=ALICE):
    return {
        "id": EXP_ID,
        "profile_id": f"profile-of-{owner}",
        "status": status,
        "baseline_days": 3,
        "intervention_days": 7,
        "metrics": METRICS,
        "started_at": (datetime.now(UTC) - started_ago).isoformat() if status != "proposed" else None,
    }


class FakeDb:
    def __init__(self):
        self.experiment = experiment_row(timedelta(hours=1))
        self.checkins: dict[tuple[str, int], dict] = {}
        self.current = ALICE

    def get_profile(self, user_id):
        return {"id": f"profile-of-{user_id}"}

    def get_experiment(self, profile_id, experiment_id):
        e = self.experiment
        return e if e["id"] == experiment_id and e["profile_id"] == profile_id else None

    def upsert(self, experiment_id, day_number, values):
        key = (experiment_id, day_number)
        old = self.checkins.get(key)
        row = {
            "id": old["id"] if old else f"00000000-0000-0000-0000-{len(self.checkins) + 1:012d}",
            "experiment_id": experiment_id,
            "day_number": day_number,
            **values,
            "created_at": old["created_at"] if old else "2026-10-28T10:00:00+00:00",
            "updated_at": "2026-10-28T11:00:00+00:00",
        }
        self.checkins[key] = row
        return row

    def list_for(self, experiment_id):
        return sorted(
            (r for (e, _), r in self.checkins.items() if e == experiment_id),
            key=lambda r: r["day_number"],
        )


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "get", fake.get_experiment)
    monkeypatch.setattr(checkins, "upsert", fake.upsert)
    monkeypatch.setattr(checkins, "list_for_experiment", fake.list_for)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


client = TestClient(app)
URL = f"/api/experiments/{EXP_ID}/checkins"


def test_requires_auth():
    assert client.post(URL, json=BODY).status_code == 401
    assert client.get(URL).status_code == 401


def test_baseline_checkin_records_day_and_phase_from_server(db):
    res = client.post(URL, json={"metric_values": VALUES})
    assert res.status_code == 200
    body = res.json()
    assert (body["day_number"], body["phase"]) == (1, "baseline")
    assert body["intervention_completed"] is False
    assert body["metric_values"] == VALUES
    assert body["note"] is None


def test_baseline_rejects_intervention_completed_true(db):
    res = client.post(URL, json=BODY)
    assert res.status_code == 422
    assert res.json()["detail"][0]["field"] == "intervention_completed"
    assert db.checkins == {}


def test_intervention_day_requires_intervention_completed(db):
    db.experiment = experiment_row(timedelta(days=3, hours=2))
    missing = client.post(URL, json={"metric_values": VALUES})
    assert missing.status_code == 422
    assert missing.json()["detail"][0]["field"] == "intervention_completed"

    res = client.post(URL, json=BODY)
    assert res.status_code == 200
    assert (res.json()["day_number"], res.json()["phase"]) == (4, "intervention")
    assert res.json()["intervention_completed"] is True
    assert res.json()["note"] == "late meeting"


def test_intervention_not_completed_is_recorded(db):
    db.experiment = experiment_row(timedelta(days=5))
    res = client.post(URL, json={**BODY, "intervention_completed": False})
    assert res.status_code == 200
    assert res.json()["intervention_completed"] is False


def test_submitting_again_updates_todays_checkin(db):
    first = client.post(URL, json={"metric_values": VALUES, "note": "first"}).json()
    second = client.post(URL, json={"metric_values": {**VALUES, "morning_energy": 9}}).json()
    assert second["id"] == first["id"]
    assert second["created_at"] == first["created_at"]
    assert second["metric_values"]["morning_energy"] == 9
    assert second["note"] is None  # replaced, not merged
    assert len(db.checkins) == 1


def test_next_day_is_a_new_checkin(db):
    client.post(URL, json={"metric_values": VALUES})
    db.experiment = experiment_row(timedelta(hours=25))
    res = client.post(URL, json={"metric_values": VALUES})
    assert res.json()["day_number"] == 2
    assert len(db.checkins) == 2


@pytest.mark.parametrize("field", ["day_number", "phase", "experiment_id", "user_id", "id"])
def test_client_cannot_set_server_derived_fields(db, field):
    assert client.post(URL, json={"metric_values": VALUES, field: 3}).status_code == 422
    assert db.checkins == {}


@pytest.mark.parametrize(
    "change,field",
    [
        ({"morning_energy": 11}, "morning_energy"),
        ({"morning_energy": 0}, "morning_energy"),
        ({"morning_energy": 7.5}, "morning_energy"),
        ({"morning_energy": True}, "morning_energy"),
        ({"minutes_to_sleep": -5}, "minutes_to_sleep"),
        ({"minutes_to_sleep": 5000}, "minutes_to_sleep"),
        ({"awakenings": True}, "awakenings"),
        ({"late_caffeine": 1}, "late_caffeine"),
        ({"surprise": 3}, "surprise"),
    ],
)
def test_invalid_metric_values_are_422(db, change, field):
    res = client.post(URL, json={"metric_values": {**VALUES, **change}})
    assert res.status_code == 422
    assert any(e.get("field") == field for e in res.json()["detail"] if isinstance(e, dict))
    assert db.checkins == {}


def test_missing_metric_is_422(db):
    values = {k: v for k, v in VALUES.items() if k != "sleep_quality"}
    res = client.post(URL, json={"metric_values": values})
    assert res.status_code == 422
    assert res.json()["detail"] == [{"field": "sleep_quality", "message": "Required"}]


def test_string_value_is_rejected(db):
    assert client.post(URL, json={"metric_values": {**VALUES, "morning_energy": "7"}}).status_code == 422


def test_whole_number_float_is_stored_as_int(db):
    res = client.post(URL, json={"metric_values": {**VALUES, "morning_energy": 7.0}})
    assert res.status_code == 200
    assert res.json()["metric_values"]["morning_energy"] == 7


def test_note_too_long_is_422(db):
    assert client.post(URL, json={"metric_values": VALUES, "note": "x" * 501}).status_code == 422


def test_blank_note_is_stored_as_null(db):
    assert client.post(URL, json={"metric_values": VALUES, "note": "   "}).json()["note"] is None


@pytest.mark.parametrize(
    "status,detail",
    [("proposed", "Start the experiment"), ("completed", "completed")],
)
def test_only_active_experiments_accept_checkins(db, status, detail):
    db.experiment = experiment_row(timedelta(days=1), status=status)
    res = client.post(URL, json={"metric_values": VALUES})
    assert res.status_code == 409
    assert detail in res.json()["detail"]
    assert db.checkins == {}


def test_checkin_after_the_last_day_is_409(db):
    db.experiment = experiment_row(timedelta(days=11))
    res = client.post(URL, json={**BODY})
    assert res.status_code == 409
    assert "over" in res.json()["detail"]


def test_cannot_use_another_users_experiment(db):
    db.current = BOB
    assert client.post(URL, json={"metric_values": VALUES}).status_code == 404
    assert client.get(URL).status_code == 404
    assert db.checkins == {}


def test_malformed_experiment_id(db):
    assert client.post("/api/experiments/nope/checkins", json=BODY).status_code == 422


def test_history_is_ordered_and_scoped(db):
    client.post(URL, json={"metric_values": VALUES})
    db.experiment = experiment_row(timedelta(days=2, hours=1))
    client.post(URL, json={"metric_values": VALUES})
    db.experiment = experiment_row(timedelta(hours=30))
    client.post(URL, json={"metric_values": VALUES})
    days = [c["day_number"] for c in client.get(URL).json()]
    assert days == [1, 2, 3]


def test_history_is_available_for_any_status_and_empty_by_default(db):
    db.experiment = experiment_row(timedelta(days=1), status="proposed")
    assert client.get(URL).json() == []


def test_database_down_is_503(db, monkeypatch):
    def boom(*_a, **_k):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(checkins, "upsert", boom)
    monkeypatch.setattr(checkins, "list_for_experiment", boom)
    assert client.post(URL, json={"metric_values": VALUES}).status_code == 503
    assert client.get(URL).status_code == 503


# --- metric validation in isolation -----------------------------------------


def test_validate_returns_cleaned_values():
    metrics = [Metric.model_validate(m) for m in METRICS]
    cleaned, errors = validate_metric_values(metrics, VALUES)
    assert errors == [] and cleaned == VALUES
