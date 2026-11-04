"""Comparing experiments, and what someone chose after one. Computed here from saved reports, with no AI call."""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations import openrouter
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import experiments, profiles, reports
from app.services import progress_summary
from tests.test_propose import PROFILE_ROW, USER_ID

client = TestClient(app)
URL = "/api/experiments/progress-summary"
EXPERIMENT_ID = UUID("22222222-2222-4222-8222-222222222222")


def metric(key, label, baseline, result, percent, kind="scale"):
    return {"key": key, "label": label, "type": kind, "primary": True, "baseline": {"mean": baseline},
            "intervention": {"mean": result}, "percent_change": percent}


def finished(number, metrics, outcome=None):
    row = {"id": f"exp-{number}", "question": f"Question {number}?", "completed_at": f"2026-10-{number:02d}T10:00:00Z",
           "intervention": {"action": f"Habit {number}"}, "is_seeded": False}
    if outcome:
        row["outcome"] = outcome
    return row, {"experiment_id": row["id"], "analysis": {"metrics": metrics}}


@pytest.fixture
def stored(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)
    paid = lambda **_kw: pytest.fail("Progress must never call a model")  # noqa: E731
    monkeypatch.setattr(openrouter, "complete", paid)
    monkeypatch.setattr(openrouter, "decide", paid)

    def install(*items):
        rows = [row for row, _ in sorted(items, key=lambda item: item[0]["completed_at"], reverse=True)]
        monkeypatch.setattr(experiments, "list_completed", lambda _profile, _limit: rows)
        monkeypatch.setattr(reports, "list_for_experiments", lambda ids: [r for _, r in items if r["experiment_id"] in ids])

    install()
    yield install
    app.dependency_overrides.clear()


def get():
    response = client.get(URL)
    assert response.status_code == 200
    return response.json()


def test_nothing_finished_shows_only_the_labelled_example(stored):
    body = get()
    assert body["metrics"] == [] and body["kept"] == []
    assert body["example"]["question"]
    assert body["example"]["metrics"], "The sample has computed numbers to show"
    assert all(run["experiment_id"] == "example" for item in body["example"]["metrics"] for run in item["runs"])


def test_a_real_result_replaces_the_example_and_is_never_mixed_with_it(stored):
    stored(finished(1, [metric("energy", "Energy", 5, 6, 20)]))
    body = get()
    assert body["example"] is None
    assert [run["experiment_id"] for run in body["metrics"][0]["runs"]] == ["exp-1"]


def test_each_metric_compares_experiments_oldest_first(stored):
    stored(finished(2, [metric("energy", "Morning energy", 6, 7.5, 25)]), finished(1, [metric("energy", "Energy", 5, 6, 20)]))
    item = get()["metrics"][0]
    assert item["label"] == "Morning energy", "The newest wording"
    assert [(r["experiment_id"], r["baseline_mean"], r["result_mean"], r["percent_change"]) for r in item["runs"]] == [
        ("exp-1", 5, 6, 20), ("exp-2", 6, 7.5, 25)]


def test_how_your_normal_moved_needs_two_experiments(stored):
    stored(finished(1, [metric("energy", "Energy", 5, 6, 20)]))
    assert get()["metrics"][0]["normal_change"] is None
    stored(finished(1, [metric("energy", "Energy", 5, 6, 20)]), finished(2, [metric("energy", "Energy", 5.5, 6, 9)]), finished(3, [metric("energy", "Energy", 6.25, 7, 12)]))
    assert get()["metrics"][0]["normal_change"] == 1.25


def test_metrics_with_different_keys_are_never_merged(stored):
    stored(finished(1, [metric("energy", "Energy", 5, 6, 20)]), finished(2, [metric("morning_energy", "Energy", 9, 9, 0)]))
    assert sorted(item["key"] for item in get()["metrics"]) == ["energy", "morning_energy"]
    assert all(item["normal_change"] is None for item in get()["metrics"])


def test_a_missing_side_stays_missing_and_is_not_invented(stored):
    stored(finished(1, [metric("energy", "Energy", None, 6, None)]), finished(2, [metric("energy", "Energy", 5, 6, 20)]))
    item = get()["metrics"][0]
    assert item["runs"][0]["baseline_mean"] is None and item["normal_change"] is None


def test_a_report_in_an_older_shape_is_left_out(stored):
    row, _ = finished(1, [])
    stored((row, {"experiment_id": row["id"], "analysis": {"not_metrics": True}}), finished(2, [metric("energy", "Energy", 5, 6, 20)]))
    assert [run["experiment_id"] for run in get()["metrics"][0]["runs"]] == ["exp-2"]


def test_kept_habits_come_from_the_choice_newest_first(stored):
    stored(finished(1, [], "keep"), finished(2, [], "variation"), finished(3, [], "keep"), finished(4, []))
    assert [(k["experiment_id"], k["habit"]) for k in get()["kept"]] == [("exp-3", "Habit 3"), ("exp-1", "Habit 1")]


def test_a_database_failure_is_reported_not_hidden(stored, monkeypatch):
    def down(*_args):
        raise SupabaseUnavailable("down")
    monkeypatch.setattr(experiments, "list_completed", down)
    assert client.get(URL).status_code == 503


@pytest.fixture
def choosing(stored, monkeypatch):
    state = {"row": {"id": str(EXPERIMENT_ID), "status": "completed", "is_seeded": False, "profile_id": PROFILE_ROW["id"]}, "written": []}
    monkeypatch.setattr(experiments, "get", lambda _profile, _id: state["row"])

    def set_outcome(profile_id, experiment_id, choice):
        state["written"].append((profile_id, experiment_id, choice))
        return {**state["row"], "outcome": choice}

    monkeypatch.setattr(experiments, "set_outcome", set_outcome)
    return state


def choose(choice="keep"):
    return client.post(f"/api/experiments/{EXPERIMENT_ID}/outcome", json={"choice": choice})


@pytest.mark.parametrize("choice", ["keep", "variation", "new"])
def test_a_finished_experiment_stores_the_choice(choosing, choice):
    response = choose(choice)
    assert response.status_code == 200 and response.json() == {"experiment_id": str(EXPERIMENT_ID), "choice": choice}
    assert choosing["written"] == [(PROFILE_ROW["id"], str(EXPERIMENT_ID), choice)]


def test_an_unknown_choice_is_refused(choosing):
    assert choose("maybe").status_code == 422 and choosing["written"] == []


def test_a_running_experiment_has_nothing_to_choose_yet(choosing):
    choosing["row"]["status"] = "active"
    assert choose().status_code == 409 and choosing["written"] == []


def test_a_sample_never_counts_as_a_kept_habit(choosing):
    choosing["row"]["is_seeded"] = True
    assert choose().status_code == 409 and choosing["written"] == []


def test_someone_elses_experiment_is_not_found(choosing):
    choosing["row"] = None
    assert choose().status_code == 404


def test_before_the_migration_the_choice_says_so_and_nothing_else_breaks(choosing, monkeypatch):
    def missing(*_args):
        raise SupabaseUnavailable("column missing")
    monkeypatch.setattr(experiments, "set_outcome", missing)
    assert choose().status_code == 503
    assert get()["kept"] == []


def test_the_limit_on_what_is_read_is_named(stored):
    assert progress_summary.MAX_EXPERIMENTS == 20
