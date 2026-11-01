import json

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.config import settings
from app.integrations import openrouter
from app.main import app
from app.repositories import checkins, experiments, profiles, reports
from tests.test_completion import ALICE, BOB, EXP_ID, FakeDb, experiment_row

NARRATIVE = {
    "summary": "Your morning energy rose about 11%, close to what we predicted.",
    "interpretation": "We predicted +8 to +15%. You saw about +11%, and 7 of 7 test days beat your baseline.",
    "personal_learnings": ["Evening movement may be linked to your next-morning energy."],
    "confounders": ["Day 7 had a skipped walk."],
    "next_experiment": {
        "question": "Does walking immediately after dinner work better than walking later?",
        "reason": "Timing may explain some of the remaining variation.",
    },
    "signal_classification": "likely_signal",
}

client = TestClient(app)
COMPLETE = f"/api/experiments/{EXP_ID}/complete"
REPORT = f"/api/experiments/{EXP_ID}/report"


class FakeModel:
    """Replaces the HTTP call so the real validation, checks and retry run."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls: list[list[dict]] = []

    def __call__(self, task, model, schema, messages, timeout):
        self.calls.append([dict(m) for m in messages])
        reply = self.replies[min(len(self.calls), len(self.replies)) - 1]
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)


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
    monkeypatch.setattr(settings, "openrouter_api_key", "test")
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def completed(db):
    assert client.post(COMPLETE).status_code == 200
    return db


def model(monkeypatch, *replies):
    fake = FakeModel(*replies)
    monkeypatch.setattr(openrouter, "_call", fake)
    return fake


def test_requires_auth():
    assert client.post(REPORT).status_code == 401
    assert client.get(REPORT).status_code == 401


def test_writes_and_saves_narrative_without_touching_the_analysis(completed, monkeypatch):
    analysis_before = json.dumps(completed.reports[EXP_ID]["analysis"], sort_keys=True)
    fake = model(monkeypatch, NARRATIVE)

    res = client.post(REPORT)
    assert res.status_code == 200
    body = res.json()
    assert body["narrative"]["summary"] == NARRATIVE["summary"]
    assert body["narrative"]["next_experiment"]["question"].startswith("Does walking immediately")
    assert body["narrative"]["confounders"] == ["Day 7 had a skipped walk."]
    assert "signal_classification" not in body["narrative"]
    assert body["analysis"]["signal"]["classification"] == "likely_signal"
    assert len(fake.calls) == 1

    # saved on the existing report columns; analysis byte-for-byte unchanged
    row = completed.reports[EXP_ID]
    assert row["interpretation"]["summary"] == NARRATIVE["summary"]
    assert row["learnings"] == NARRATIVE["personal_learnings"]
    assert row["next_experiment"]["reason"].startswith("Timing")
    assert json.dumps(row["analysis"], sort_keys=True) == analysis_before

    assert client.get(REPORT).json()["narrative"] == body["narrative"]


def test_model_is_given_the_analysis_and_notes_as_data(completed, monkeypatch):
    completed.checkins[4]["note"] = "late night, very stressful day"
    fake = model(monkeypatch, NARRATIVE)
    client.post(REPORT)
    system, user = fake.calls[0][0]["content"], fake.calls[0][1]["content"]
    assert "source of truth" in system and "Never recompute" in system
    assert "<analysis>" in user and '"likely_signal"' in user
    assert "late night, very stressful day" in user
    assert "<daily_checkins>" in user


def test_second_call_does_not_call_the_model_again(completed, monkeypatch):
    fake = model(monkeypatch, NARRATIVE)
    client.post(REPORT)
    again = client.post(REPORT)
    assert again.status_code == 200 and again.json()["narrative"]["summary"] == NARRATIVE["summary"]
    assert len(fake.calls) == 1


def test_regenerate_writes_a_new_narrative(completed, monkeypatch):
    fake = model(monkeypatch, NARRATIVE, {**NARRATIVE, "summary": "A second take."})
    client.post(REPORT)
    res = client.post(REPORT + "?regenerate=true")
    assert res.json()["narrative"]["summary"] == "A second take."
    assert len(fake.calls) == 2


def test_wrong_signal_classification_is_rejected_and_retried(completed, monkeypatch):
    fake = model(monkeypatch, {**NARRATIVE, "signal_classification": "probably_noise"}, NARRATIVE)
    assert client.post(REPORT).status_code == 200
    assert len(fake.calls) == 2
    assert "must be exactly 'likely_signal'" in fake.calls[1][-1]["content"]


def test_model_that_keeps_contradicting_the_classification_saves_nothing(completed, monkeypatch):
    model(monkeypatch, {**NARRATIVE, "signal_classification": "unclear"})
    assert client.post(REPORT).status_code == 502
    assert completed.reports[EXP_ID].get("interpretation") is None
    assert client.get(REPORT).json()["narrative"] is None


def test_overclaiming_language_is_rejected_and_retried(completed, monkeypatch):
    bad = {**NARRATIVE, "summary": "This proves that walking improves your energy."}
    fake = model(monkeypatch, bad, NARRATIVE)
    assert client.post(REPORT).status_code == 200
    assert len(fake.calls) == 2
    assert "prove" in fake.calls[1][-1]["content"]


def test_saying_the_user_predicted_it_is_rejected_and_retried(completed, monkeypatch):
    bad = {**NARRATIVE, "interpretation": "You predicted +8 to +15% and saw about +11%."}
    fake = model(monkeypatch, bad, NARRATIVE)
    assert client.post(REPORT).status_code == 200
    assert len(fake.calls) == 2
    assert "we predicted" in fake.calls[1][-1]["content"]


def test_overlong_interpretation_is_rejected_and_retried(completed, monkeypatch):
    bad = {**NARRATIVE, "interpretation": "We predicted a gain and it happened. " * 20}
    fake = model(monkeypatch, bad, NARRATIVE)
    assert client.post(REPORT).status_code == 200
    assert len(fake.calls) == 2


def test_prompt_asks_for_forecast_wording_and_a_short_interpretation(completed, monkeypatch):
    fake = model(monkeypatch, NARRATIVE)
    client.post(REPORT)
    system = fake.calls[0][0]["content"]
    assert 'Never say the user predicted anything' in system
    assert "under 450 characters" in system


def test_unsafe_next_experiment_is_rejected(completed, monkeypatch):
    bad = {**NARRATIVE, "next_experiment": {"question": "Try sleeping 3 hours a night for a week?", "reason": "Test the limits."}}
    model(monkeypatch, bad)
    assert client.post(REPORT).status_code == 502
    assert client.get(REPORT).json()["narrative"] is None


def test_invalid_json_twice_is_502(completed, monkeypatch):
    model(monkeypatch, "not json")
    assert client.post(REPORT).status_code == 502


def test_ai_unavailable_is_503_and_report_still_readable(completed, monkeypatch):
    model(monkeypatch, openrouter.AIUnavailable("down"))
    assert client.post(REPORT).status_code == 503
    res = client.get(REPORT)
    assert res.status_code == 200 and res.json()["narrative"] is None
    assert res.json()["analysis"]["signal"]["classification"] == "likely_signal"


def test_must_be_completed_first(db, monkeypatch):
    model(monkeypatch, NARRATIVE)
    assert client.post(REPORT).status_code == 409  # still active
    db.experiment = experiment_row("proposed")
    assert client.post(REPORT).status_code == 409


def test_completed_without_a_report_row_is_404(db, monkeypatch):
    db.experiment = experiment_row("completed")
    model(monkeypatch, NARRATIVE)
    assert client.post(REPORT).status_code == 404
    assert client.get(REPORT).status_code == 404


def test_other_users_cannot_read_or_write_the_report(completed, monkeypatch):
    model(monkeypatch, NARRATIVE)
    completed.current = BOB
    assert client.get(REPORT).status_code == 404
    assert client.post(REPORT).status_code == 404


def test_chart_data_is_ready_to_plot(completed):
    chart = client.get(REPORT).json()["chart"]
    assert chart["primary_metric"]["key"] == "morning_energy"
    assert chart["baseline_days"] == 3 and chart["intervention_days"] == 7
    points = chart["points"]
    assert [p["day"] for p in points] == list(range(1, 11))
    assert [p["phase"] for p in points] == ["baseline"] * 3 + ["intervention"] * 7
    assert points[0]["value"] == 5 and points[9]["value"] == 6
    assert points[3]["intervention_completed"] is True
    assert points[6]["intervention_completed"] is False  # the skipped walk
    assert set(points[0]["values"]) == {"morning_energy", "sleep_quality", "walked"}
    assert chart["baseline_mean"] == pytest.approx(5.667, abs=1e-3)
    assert chart["intervention_mean"] == pytest.approx(6.286, abs=1e-3)
    band = chart["predicted_band"]
    assert (band["min_percent"], band["max_percent"], band["midpoint_percent"]) == (8, 15, 11.5)
    assert band["expected_value_min"] == pytest.approx(5.667 * 1.08, abs=1e-2)
    assert band["expected_value_max"] == pytest.approx(5.667 * 1.15, abs=1e-2)


def test_chart_includes_missing_days_and_notes(completed):
    # The stored analysis already includes day 2: removing a row after completion
    # must not invent a new missed day in that immutable analysis.
    completed.checkins = [c for c in completed.checkins if c["day_number"] != 2]
    completed.checkins[2]["note"] = "hard day"
    points = client.get(REPORT).json()["chart"]["points"]
    assert points[1] == {
        "day": 2, "phase": "baseline", "logged": False, "missed": False, "intervention_completed": None,
        "value": None, "values": None, "note": None,
    }
    assert any(p["note"] == "hard day" for p in points)


def test_lab_report_carries_the_whole_experiment(completed):
    body = client.get(REPORT).json()
    assert body["experiment"]["status"] == "completed"
    assert body["experiment"]["prediction"]["expected_change_max"] == 15
    assert body["analysis"]["prediction"]["accuracy_percent"] > 90
    assert body["created_at"]


def test_narratives_saved_under_older_rules_still_load(completed):
    """Tightening the generation rules must not break reading an existing report."""
    completed.reports[EXP_ID].update(
        interpretation={
            "summary": "s",
            "interpretation": "You predicted a gain. " * 60,  # long, and old wording
            "confounders": [],
        },
        learnings=["l"],
        next_experiment={"question": "q", "reason": "r"},
    )
    res = client.get(REPORT)
    assert res.status_code == 200
    assert len(res.json()["narrative"]["interpretation"]) > 600
