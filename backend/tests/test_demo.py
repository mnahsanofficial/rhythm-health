from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.demo import seed
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles, reports
from app.schemas.analysis import Analysis
from app.schemas.lab_report import LabReport, NarrativeDraft
from app.services import demo

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"
RESET = "/api/demo/reset"


class FakeDb:
    """Tables as lists, with delete cascading the way the real foreign keys do."""

    def __init__(self):
        self.experiments: list[dict] = []
        self.checkins: list[dict] = []
        self.reports: dict[str, dict] = {}
        self.current = ALICE
        self.fail_on_create = None

    def get_profile(self, user_id):
        return {"id": f"profile-of-{user_id}"}

    def delete_seeded(self, profile_id):
        gone = {e["id"] for e in self.experiments if e["profile_id"] == profile_id and e["is_seeded"]}
        self.experiments = [e for e in self.experiments if e["id"] not in gone]
        self.checkins = [c for c in self.checkins if c["experiment_id"] not in gone]
        self.reports = {k: v for k, v in self.reports.items() if k not in gone}

    def delete_sample(self, profile_id, experiment_id):
        gone = {e["id"] for e in self.experiments if e["profile_id"] == profile_id and e["id"] == experiment_id and e["is_seeded"]}
        self.experiments = [e for e in self.experiments if e["id"] not in gone]
        self.checkins = [c for c in self.checkins if c["experiment_id"] not in gone]
        self.reports = {k: v for k, v in self.reports.items() if k not in gone}

    def create(self, profile_id, values):
        if self.fail_on_create:
            raise self.fail_on_create
        if any(e["id"] == values["id"] for e in self.experiments):
            raise SupabaseConflict()
        row = {
            "profile_id": profile_id,
            "created_at": "2026-11-01T10:00:00+00:00",
            "updated_at": "2026-11-01T10:00:00+00:00",
            **values,
        }
        self.experiments.append(row)
        return row

    def create_many(self, experiment_id, rows):
        new = [{**r, "experiment_id": experiment_id} for r in rows]
        self.checkins += new
        return new

    def upsert_report(self, experiment_id, analysis):
        row = {"experiment_id": experiment_id, "analysis": analysis, "interpretation": None,
               "learnings": None, "next_experiment": None, "created_at": "2026-11-01T10:00:00+00:00"}
        self.reports[experiment_id] = row
        return row

    def save_narrative(self, experiment_id, columns):
        self.reports[experiment_id].update(columns)
        return self.reports[experiment_id]

    def add_real(self, owner, status, **extra):
        pid = f"profile-of-{owner}"
        row = {
            "id": f"real-{len(self.experiments)}", "profile_id": pid, "status": status,
            "is_seeded": False, "question": "A real experiment", "category": "sleep",
            "hypothesis": "h", "intervention": {"action": "a", "timing": "t", "frequency": "daily"},
            "baseline_days": 3, "intervention_days": 7, "metrics": seed.EXPERIMENT["metrics"],
            "success_criteria": seed.EXPERIMENT["success_criteria"],
            "prediction": seed.EXPERIMENT["prediction"], "started_at": None, "completed_at": None,
            "created_at": "2026-10-01T10:00:00+00:00", "updated_at": "2026-10-01T10:00:00+00:00",
            **extra,
        }
        self.experiments.append(row)
        return row


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "delete_seeded", fake.delete_seeded)
    monkeypatch.setattr(experiments, "delete_sample", fake.delete_sample)
    monkeypatch.setattr(experiments, "create", fake.create)
    monkeypatch.setattr(checkins, "create_many", fake.create_many)
    monkeypatch.setattr(reports, "upsert", fake.upsert_report)
    monkeypatch.setattr(reports, "save_narrative", fake.save_narrative)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


client = TestClient(app)


def test_requires_auth():
    app.dependency_overrides.clear()
    assert client.post(RESET, json={}).status_code == 401


def test_returns_the_completed_seeded_lab_report(db):
    res = client.post(RESET, json={})
    assert res.status_code == 200
    report = LabReport.model_validate(res.json())
    exp = report.experiment
    assert exp.status == "completed" and exp.is_seeded
    assert exp.progress.state == "completed"
    assert exp.question == seed.QUESTION
    assert report.narrative is not None
    assert [p.logged for p in report.chart.points] == [True] * 10
    assert len(db.checkins) == 10 and db.experiments[0]["profile_id"] == f"profile-of-{ALICE}"


def test_analysis_is_computed_and_matches_the_planned_demo(db):
    report = LabReport.model_validate(client.post(RESET, json={}).json())
    a = report.analysis
    assert a.signal.classification == "likely_signal"
    primary = a.metrics[0]
    assert 10 < primary.percent_change < 12  # about 11%
    assert a.prediction.within_predicted_range and a.prediction.direction_correct
    assert a.adherence.missing_days == [] and a.adherence.coverage_rate == 1.0
    assert a.adherence.intervention_days_completed == 6  # one skipped walk
    # what is stored is what the report shows
    assert Analysis.model_validate(db.reports[str(exp_id(report))]["analysis"]) == a


def exp_id(report):
    return report.experiment.id


def test_written_narrative_passes_the_same_guardrails_as_generated_ones(db):
    n = seed.narrative()
    NarrativeDraft.model_validate(
        {**n.model_dump(), "signal_classification": "likely_signal"}
    )
    # and the numbers it quotes agree with the computed analysis
    a = LabReport.model_validate(client.post(RESET, json={}).json()).analysis
    assert "11%" in n.summary and round(a.metrics[0].percent_change) == 11
    assert "5.7" in n.interpretation and "6.3" in n.interpretation
    assert round(a.metrics[0].baseline.mean, 1) == 5.7 and round(a.metrics[0].intervention.mean, 1) == 6.3


def test_reset_is_idempotent_and_keeps_the_same_id(db):
    first = client.post(RESET, json={}).json()
    second = client.post(RESET, json={}).json()
    third = client.post(RESET, json={}).json()
    assert first["experiment"]["id"] == second["experiment"]["id"] == third["experiment"]["id"]
    assert len([e for e in db.experiments if e["is_seeded"]]) == 1
    assert len(db.checkins) == 10 and len(db.reports) == 1
    assert first["analysis"] == third["analysis"]


def test_reset_replaces_edited_demo_data(db):
    client.post(RESET, json={})
    db.checkins[0]["metric_values"] = {"morning_energy": 1, "sleep_quality": 1}
    db.experiments[0]["question"] = "tampered"
    again = client.post(RESET, json={}).json()
    assert again["experiment"]["question"] == seed.QUESTION
    assert db.checkins[0]["metric_values"]["morning_energy"] == 5


def test_normal_experiments_including_an_active_one_are_untouched(db):
    active = db.add_real(ALICE, "active", started_at="2026-10-30T10:00:00+00:00")
    proposed = db.add_real(ALICE, "proposed")
    done = db.add_real(ALICE, "completed", completed_at="2026-10-20T10:00:00+00:00")
    db.checkins.append({"experiment_id": active["id"], "day_number": 1})
    before = [dict(e) for e in db.experiments]

    client.post(RESET, json={})
    client.post(RESET, json={})

    kept = [e for e in db.experiments if not e["is_seeded"]]
    assert kept == before
    assert {e["id"] for e in kept} == {active["id"], proposed["id"], done["id"]}
    assert any(c["experiment_id"] == active["id"] for c in db.checkins)


def test_only_the_signed_in_users_demo_is_reset(db):
    db.current = BOB
    bob_demo = client.post(RESET, json={}).json()["experiment"]["id"]
    db.current = ALICE
    alice_demo = client.post(RESET, json={}).json()["experiment"]["id"]
    assert bob_demo != alice_demo  # one demo per profile
    client.post(RESET, json={})  # Alice resets again
    owners = sorted(e["profile_id"] for e in db.experiments)
    assert owners == [f"profile-of-{ALICE}", f"profile-of-{BOB}"]


def test_body_is_optional_but_cannot_name_a_user(db):
    assert client.post(RESET).status_code == 200
    assert client.post(RESET, json={}).status_code == 200
    assert client.post(RESET, json={"user_id": BOB}).status_code == 422
    assert client.post(RESET, json={"profile_id": "x"}).status_code == 422


def test_no_profile_is_409(db, monkeypatch):
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: None)
    assert client.post(RESET, json={}).status_code == 409


def test_race_is_a_409_and_outage_a_503(db):
    db.fail_on_create = SupabaseConflict()
    assert client.post(RESET, json={}).status_code == 409
    db.fail_on_create = SupabaseUnavailable("down")
    assert client.post(RESET, json={}).status_code == 503


def test_dates_stay_recent_and_whole_days(db):
    now = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
    report = demo.reset("profile-of-x", now)
    exp = report.experiment
    assert (now - exp.completed_at).days == seed.FINISHED_DAYS_AGO
    assert (exp.completed_at - exp.started_at).days == 10
