import json

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import experiments, profiles, reports
from app.schemas.analysis import Analysis
from app.services import history
from tests.test_propose import CLASSIFICATION, PROFILE_ROW, USER_ID, FakeAI
from app.integrations import openrouter

PROFILE_ID = PROFILE_ROW["id"]


def analysis(percent=12.0, *, signal="likely_signal", accuracy=70.0, in_range=True, direction_ok=True):
    stats = {"n": 3, "mean": 5.0, "median": 5.0, "sd": 1.0}
    return Analysis.model_validate(
        {
            "primary_metric": "morning_energy",
            "success_criteria_percent": 10,
            "adherence": {
                "baseline_days_planned": 3,
                "baseline_days_logged": 3,
                "intervention_days_planned": 7,
                "intervention_days_logged": 7,
                "intervention_days_completed": 6,
                "adherence_rate": 0.86,
                "coverage_rate": 1.0,
                "missing_days": [],
            },
            "metrics": [
                {
                    "key": "morning_energy",
                    "label": "Morning energy",
                    "type": "scale",
                    "primary": True,
                    "baseline": stats,
                    "intervention": stats,
                    "percent_change": percent,
                    "effect_size": 1.1,
                    "outliers": [],
                }
            ],
            "prediction": {
                "predicted_direction": "increase",
                "predicted_min": 5,
                "predicted_max": 10,
                "predicted_midpoint": 7.5,
                "observed_change_percent": percent,
                "error_points": percent - 7.5,
                "within_predicted_range": in_range,
                "direction_correct": direction_ok,
                "accuracy_percent": accuracy,
            },
            "signal": {
                "classification": signal,
                "reasons": ["large_effect"],
                "success_criteria_met": True,
                "matches_predicted_direction": True,
            },
        }
    ).model_dump(mode="json")


def row(n, category="sleep", **over):
    base = {
        "id": f"00000000-0000-0000-0000-{n:012d}",
        "question": f"Does habit {n} help?",
        "category": category,
        "intervention": {"action": "Walk", "timing": "after dinner", "frequency": "daily"},
        "baseline_days": 3,
        "intervention_days": 7,
        "prediction": {
            "direction": "increase",
            "expected_change_min": 5,
            "expected_change_max": 10,
            "confidence": "moderate",
            "target_metric": "morning_energy",
            "reasoning": "private reasoning",
            "uncertainty_factors": ["x"],
        },
        "completed_at": f"2026-10-{n:02d}T10:00:00+00:00",
        "note": "should never be passed on",
    }
    base.update(over)
    return base


@pytest.fixture
def db(monkeypatch):
    state = {"rows": [], "analyses": {}}
    monkeypatch.setattr(experiments, "list_completed", lambda pid, limit: state["rows"][:limit])
    monkeypatch.setattr(
        reports,
        "list_for_experiments",
        lambda ids: [
            {"experiment_id": i, "analysis": state["analyses"][i]} for i in ids if i in state["analyses"]
        ],
    )

    def add(r, a=None):
        state["rows"].append(r)
        state["analyses"][r["id"]] = a if a is not None else analysis()

    state["add"] = add
    return state


def test_no_history_is_none(db):
    assert history.load(PROFILE_ID, "sleep") is None


def test_summary_carries_results_not_raw_data(db):
    db["add"](row(1))
    ctx = history.load(PROFILE_ID, "sleep")
    dumped = ctx.model_dump_json()
    item = ctx.experiments[0]
    assert item.observed_change_percent == 12.0
    assert item.signal == "likely_signal"
    assert item.predicted_change_min_percent == 5 and item.predicted_change_max_percent == 10
    assert item.intervention == "Walk (after dinner, daily)"
    # nothing raw: no check-in values, notes, ids or the old reasoning text
    for leaked in ("should never be passed on", "private reasoning", "00000000-0000"):
        assert leaked not in dumped


def test_same_category_first_then_newest_and_capped(db):
    db["add"](row(9, "food"))  # newest, other category
    db["add"](row(8, "food"))
    for n in (7, 6, 5, 4, 3):
        db["add"](row(n, "sleep"))
    ctx = history.load(PROFILE_ID, "sleep")
    assert len(ctx.experiments) == history.MAX_EXPERIMENTS
    assert [i.category for i in ctx.experiments] == ["sleep"] * 5
    assert [i.question for i in ctx.experiments][0] == "Does habit 7 help?"


def test_other_categories_fill_in_when_few_match(db):
    db["add"](row(2, "food"))
    db["add"](row(1, "sleep"))
    ctx = history.load(PROFILE_ID, "sleep")
    assert [i.category for i in ctx.experiments] == ["sleep", "food"]


def test_track_record(db):
    db["add"](row(1), analysis(15.0, direction_ok=True, in_range=False))  # error +7.5
    db["add"](row(2), analysis(2.5, direction_ok=False, in_range=False))  # error -5
    ctx = history.load(PROFILE_ID, "sleep")
    assert ctx.track_record.experiments == 2
    assert ctx.track_record.direction_correct == 1
    assert ctx.track_record.within_range == 0
    assert ctx.track_record.average_error_points == 1.2


def test_experiment_without_report_or_with_old_report_is_skipped(db):
    r = row(1)
    db["rows"].append(r)  # completed but no report row
    db["add"](row(2), {"unexpected": "old shape"})
    db["add"](row(3))
    ctx = history.load(PROFILE_ID, "sleep")
    assert [i.question for i in ctx.experiments] == ["Does habit 3 help?"]


def test_unreadable_history_is_none(monkeypatch):
    def boom(*_a):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(experiments, "list_completed", boom)
    assert history.load(PROFILE_ID, "sleep") is None


# --- through the propose endpoint ------------------------------------------------


@pytest.fixture
def propose_api(monkeypatch, db):
    monkeypatch.setattr(experiments, "supports_personal_guess", lambda _profile: True)
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)
    fake = FakeAI()
    prompts = []

    def complete(**kw):
        if kw["task"] == "experiment_design":
            prompts.append((kw["system"], kw["user"]))
        return fake(**kw)

    monkeypatch.setattr(openrouter, "complete", complete)
    monkeypatch.setattr(
        openrouter,
        "decide",
        lambda **_kw: {k: {"type": "choice", "choice": v} for k, v in CLASSIFICATION.items()},
    )
    yield prompts
    app.dependency_overrides.clear()


def propose():
    return TestClient(app).post(
        "/api/experiments/propose", json={"question": "Does walking after dinner help my sleep?"}
    )


def test_past_results_reach_the_model_input(propose_api, db):
    db["add"](row(1), analysis(15.0))
    assert propose().status_code == 200
    system, user = propose_api[0]
    assert "<history>" in user
    history_json = json.loads(user.split("<history>")[1].split("</history>")[0])
    assert history_json["experiments"][0]["observed_change_percent"] == 15.0
    assert history_json["track_record"]["experiments"] == 1
    assert "<history>" in system  # the prompt explains how to use it


def test_no_history_block_without_past_experiments(propose_api):
    assert propose().status_code == 200
    assert "<history>" not in propose_api[0][1]


def test_proposal_still_works_when_history_is_unreadable(propose_api, monkeypatch):
    def boom(*_a):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(experiments, "list_completed", boom)
    assert propose().status_code == 200
    assert "<history>" not in propose_api[0][1]
