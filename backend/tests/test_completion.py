from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles, reports
from tests.test_analysis import METRICS, PREDICTION, SEEDED, make_checkins

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"
EXP_ID = "11111111-1111-1111-1111-111111111111"


def experiment_row(status="active"):
    return {
        "id": EXP_ID,
        "profile_id": f"profile-of-{ALICE}",
        "status": status,
        "question": "q",
        "category": "energy",
        "hypothesis": "h",
        "intervention": {"action": "walk", "timing": "after dinner", "frequency": "daily"},
        "baseline_days": 3,
        "intervention_days": 7,
        "metrics": METRICS,
        "success_criteria": {"primary_metric": "morning_energy", "minimum_change_percent": 10},
        "prediction": PREDICTION,
        "started_at": (datetime.now(UTC) - timedelta(days=11)).isoformat() if status != "proposed" else None,
        "completed_at": None,
        "is_seeded": False,
        "created_at": "2026-10-01T10:00:00+00:00",
        "updated_at": "2026-10-01T10:00:00+00:00",
    }


class FakeDb:
    def __init__(self):
        self.experiment = experiment_row()
        self.checkins = [{**c, "experiment_id": EXP_ID} for c in SEEDED]
        self.reports: dict[str, dict] = {}
        self.current = ALICE

    def get_profile(self, user_id):
        return {"id": f"profile-of-{user_id}"}

    def get_experiment(self, profile_id, experiment_id):
        e = self.experiment
        return e if e["id"] == experiment_id and e["profile_id"] == profile_id else None

    def list_checkins(self, experiment_id):
        return self.checkins

    def upsert_report(self, experiment_id, analysis):
        row = {"experiment_id": experiment_id, "analysis": analysis, "interpretation": None,
               "learnings": None, "next_experiment": None, "created_at": "2026-11-08T10:00:00+00:00"}
        self.reports[experiment_id] = row
        return row

    def get_report(self, experiment_id):
        return self.reports.get(experiment_id)

    def save_narrative(self, experiment_id, columns):
        row = self.reports.get(experiment_id)
        if row is None:
            return None
        row.update(columns)
        return row

    def complete(self, profile_id, experiment_id, completed_at):
        e = self.get_experiment(profile_id, experiment_id)
        if e is None or e["status"] != "active":
            return None
        e.update(status="completed", completed_at=completed_at)
        return e


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "get", fake.get_experiment)
    monkeypatch.setattr(experiments, "complete", fake.complete)
    monkeypatch.setattr(checkins, "list_for_experiment", fake.list_checkins)
    monkeypatch.setattr(reports, "upsert", fake.upsert_report)
    monkeypatch.setattr(reports, "get", fake.get_report)
    monkeypatch.setattr(reports, "save_narrative", fake.save_narrative)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


client = TestClient(app)
COMPLETE = f"/api/experiments/{EXP_ID}/complete"
REPORT = f"/api/experiments/{EXP_ID}/report"


def test_requires_auth():
    assert client.post(COMPLETE).status_code == 401
    assert client.get(REPORT).status_code == 401


def test_complete_runs_analysis_saves_report_and_marks_completed(db):
    res = client.post(COMPLETE)
    assert res.status_code == 200
    body = res.json()
    assert body["experiment"]["status"] == "completed"
    assert body["experiment"]["completed_at"] is not None
    assert body["experiment"]["progress"]["state"] == "completed"
    analysis = body["analysis"]
    assert analysis["signal"]["classification"] == "likely_signal"
    assert analysis["prediction"]["within_predicted_range"] is True
    assert analysis["adherence"]["intervention_days_completed"] == 6
    assert db.experiment["status"] == "completed"
    assert EXP_ID in db.reports
    assert body["narrative"] is None  # written afterwards by POST /report
    assert len(body["chart"]["points"]) == 10


def test_report_can_be_read_back(db):
    assert client.get(REPORT).status_code == 404
    client.post(COMPLETE)
    res = client.get(REPORT)
    assert res.status_code == 200
    assert res.json()["analysis"]["signal"]["classification"] == "likely_signal"


def test_not_enough_checkins_is_409_with_counts(db):
    db.checkins = [c for c in db.checkins if c["day_number"] in (1, 4, 5)]  # 1 baseline, 2 intervention
    res = client.post(COMPLETE)
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert (detail["baseline_checkins"], detail["baseline_required"]) == (1, 2)
    assert (detail["intervention_checkins"], detail["intervention_required"]) == (2, 3)
    assert db.experiment["status"] == "active"
    assert db.reports == {}


def test_minimum_data_is_enough(db):
    db.checkins = [c for c in db.checkins if c["day_number"] in (1, 2, 4, 5, 6)]
    assert client.post(COMPLETE).status_code == 200


def test_complete_twice_is_409(db):
    assert client.post(COMPLETE).status_code == 200
    again = client.post(COMPLETE)
    assert again.status_code == 409
    assert "already completed" in again.json()["detail"]


def test_proposed_experiment_cannot_be_completed(db):
    db.experiment = experiment_row("proposed")
    assert client.post(COMPLETE).status_code == 409


def test_cannot_complete_or_read_another_users_experiment(db):
    client.post(COMPLETE)
    db.current = BOB
    assert client.post(COMPLETE).status_code == 404
    assert client.get(REPORT).status_code == 404


def test_lost_race_is_409_and_not_double_completed(db, monkeypatch):
    monkeypatch.setattr(experiments, "complete", lambda *_a: None)
    assert client.post(COMPLETE).status_code == 409


def test_completed_experiment_rejects_new_checkins(db):
    client.post(COMPLETE)
    res = client.post(
        f"/api/experiments/{EXP_ID}/checkins",
        json={"intervention_completed": True, "metric_values": {"morning_energy": 7, "sleep_quality": 6, "walked": True}},
    )
    assert res.status_code == 409


def test_database_down_is_503(db, monkeypatch):
    def boom(*_a, **_k):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(reports, "upsert", boom)
    assert client.post(COMPLETE).status_code == 503
    assert db.experiment["status"] == "active"
