"""One check-in across several experiments. Supabase is faked; no check-in path may call the AI."""
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations import openrouter
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles
from app.services.today_checkin import questions_for

client = TestClient(app)
ALICE, BOB = "aaaaaaaa-0000-0000-0000-000000000001", "bbbbbbbb-0000-0000-0000-000000000002"
TODAY = "/api/checkins/today"
A, B, C = "aaaaaaaa-1111-4111-8111-111111111111", "bbbbbbbb-1111-4111-8111-111111111111", "cccccccc-1111-4111-8111-111111111111"


def metric(key="energy", low="Drained", high="Full of energy", **extra):
    return {"key": key, "label": key.title(), "type": "scale", "min": 1, "max": 10, "primary": False,
            "min_label": low, "max_label": high, **extra}


def row(id=A, days_ago=1, metrics=None, owner=ALICE, status="active", **extra):
    return {
        "id": id, "profile_id": f"profile-of-{owner}", "status": status, "question": f"Question {id[0]}?",
        "category": "energy", "hypothesis": "h", "intervention": {"action": f"Change {id[0]}", "timing": "t", "frequency": "daily"},
        "baseline_days": 3, "intervention_days": 7, "metrics": metrics or [metric(primary=True)],
        "success_criteria": {"primary_metric": "energy", "minimum_change_percent": 10},
        "prediction": {}, "started_at": (datetime.now(UTC) - timedelta(days=days_ago, minutes=1)).isoformat(),
        "completed_at": None, "is_seeded": False, "created_at": "2026-10-01T10:00:00+00:00", "updated_at": "2026-10-01T10:00:00+00:00", **extra,
    }


class FakeDb:
    def __init__(self):
        self.rows = []
        self.saved = {}
        self.current = ALICE

    def list_active(self, profile_id, status=None):
        return [r for r in self.rows if r["profile_id"] == profile_id and (status is None or r["status"] == status)]

    def upsert_many(self, rows):
        for r in rows:
            self.saved[(r["experiment_id"], r["day_number"])] = r
        return rows

    def list_checkins(self, experiment_id):
        return [r for (eid, _), r in self.saved.items() if eid == experiment_id]


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", lambda uid: {"id": f"profile-of-{uid}"})
    monkeypatch.setattr(experiments, "list_for_profile", fake.list_active)
    monkeypatch.setattr(checkins, "upsert_many", fake.upsert_many, raising=False)
    monkeypatch.setattr(checkins, "list_for_experiment", fake.list_checkins)
    monkeypatch.setattr(openrouter, "complete", Mock(side_effect=AssertionError("No AI in a check-in")))
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


def ids(today):
    return {q["metric"]["key"]: q["id"] for q in today["questions"]}


def body(today, value=7, **extra):
    return {"revision": today["revision"], "answers": {q["id"]: value for q in today["questions"]}, **extra}


# --- the combining rule -----------------------------------------------------------------


def test_identical_questions_combine_into_one():
    groups = questions_for([row(A), row(B)])
    assert len(groups) == 1
    assert groups[0].experiment_ids == [A, B]


@pytest.mark.parametrize("other", [
    metric(min=0),
    metric(max=5),
    metric(low="Tired"),
    metric(high="Great"),
    metric(low=None),
    metric(type="number", min=None, max=None, low=None, high=None),
    metric(key="morning_energy"),
])
def test_questions_that_differ_in_any_way_stay_separate(other):
    groups = questions_for([row(A), row(B, metrics=[other])])
    assert len(groups) == 2
    assert [g.experiment_ids for g in groups] == [[A], [B]]
    assert groups[0].id != groups[1].id


def test_a_different_label_alone_does_not_stop_combining_the_same_measure():
    groups = questions_for([row(A), row(B, metrics=[metric(label="How is your energy?")])])
    assert len(groups) == 1


def test_shared_questions_come_first():
    a = row(A, metrics=[metric("solo_a"), metric("shared")])
    b = row(B, metrics=[metric("shared")])
    assert [g.metric.key for g in questions_for([a, b])] == ["shared", "solo_a"]


# --- reading today ----------------------------------------------------------------------


def test_requires_auth():
    assert client.get(TODAY).status_code == 401
    assert client.post(TODAY, json={}).status_code == 401


def test_today_lists_each_experiments_own_day_and_phase(db):
    db.rows = [row(A, days_ago=0), row(B, days_ago=4)]
    today = client.get(TODAY).json()
    second, first = today["experiments"]  # Oldest first.
    assert (first["id"], first["day_number"], first["phase"], first["change_required"]) == (A, 1, "baseline", False)
    assert (second["id"], second["day_number"], second["phase"], second["change_required"]) == (B, 5, "intervention", True)
    assert today["questions"][0]["experiment_ids"] == [B, A]
    assert today["all_recorded"] is False


def test_samples_finished_and_ended_experiments_are_not_due(db):
    db.rows = [row(A), row(B, is_seeded=True), row(C, days_ago=20)]
    today = client.get(TODAY).json()
    assert [e["id"] for e in today["experiments"]] == [A]
    assert today["questions"][0]["experiment_ids"] == [A]


def test_only_this_persons_experiments(db):
    db.rows = [row(A, owner=BOB)]
    assert client.get(TODAY).json()["experiments"] == []


def test_today_prefills_answers_already_recorded(db):
    db.rows = [row(A), row(B)]
    today = client.get(TODAY).json()
    client.post(TODAY, json=body(today, 8, note="late night"))
    again = client.get(TODAY).json()
    assert again["questions"][0]["value"] == 8
    assert again["note"] == "late night"
    assert again["all_recorded"] is True


def test_outage_on_read_is_503(db, monkeypatch):
    monkeypatch.setattr(experiments, "list_for_profile", Mock(side_effect=SupabaseUnavailable("down")))
    assert client.get(TODAY).status_code == 503


# --- saving -----------------------------------------------------------------------------


def test_one_answer_is_saved_to_every_experiment_it_feeds_on_its_own_day(db):
    db.rows = [row(A, days_ago=0), row(B, days_ago=4)]
    today = client.get(TODAY).json()
    response = client.post(TODAY, json=body(today, 7, changes={B: True}, note="  a note "))
    assert response.status_code == 200
    assert response.json()["all_recorded"] is True
    first, second = db.saved[(A, 1)], db.saved[(B, 5)]
    assert first["metric_values"] == second["metric_values"] == {"energy": 7}
    assert (first["phase"], first["intervention_completed"]) == ("baseline", False)
    assert (second["phase"], second["intervention_completed"]) == ("intervention", True)
    assert first["note"] == second["note"] == "a note"


def test_each_experiment_gets_only_its_own_questions(db):
    db.rows = [row(A, metrics=[metric("shared"), metric("only_a")]), row(B, metrics=[metric("shared")])]
    today = client.get(TODAY).json()
    answers = {ids(today)["shared"]: 5, ids(today)["only_a"]: 6}
    assert client.post(TODAY, json={"revision": today["revision"], "answers": answers}).status_code == 200
    assert db.saved[(A, 2)]["metric_values"] == {"shared": 5, "only_a": 6}
    assert db.saved[(B, 2)]["metric_values"] == {"shared": 5}


def test_saving_writes_everything_in_one_request(db, monkeypatch):
    db.rows = [row(A), row(B)]
    write = Mock(return_value=[])
    monkeypatch.setattr(checkins, "upsert_many", write)
    today = client.get(TODAY).json()
    assert client.post(TODAY, json=body(today)).status_code == 200
    write.assert_called_once()
    assert len(write.call_args.args[0]) == 2


def test_a_failed_read_after_saving_does_not_report_the_save_as_failed(db, monkeypatch):
    db.rows = [row(A), row(B)]
    today = client.get(TODAY).json()
    monkeypatch.setattr(checkins, "list_for_experiment", Mock(side_effect=SupabaseUnavailable("down")))
    response = client.post(TODAY, json=body(today, 7, note="note"))
    assert response.status_code == 200
    assert response.json()["all_recorded"] is True
    assert response.json()["questions"][0]["value"] == 7
    assert response.json()["note"] == "note"


def test_a_failed_write_is_503(db, monkeypatch):
    db.rows = [row(A), row(B)]
    monkeypatch.setattr(checkins, "upsert_many", Mock(side_effect=SupabaseUnavailable("down")))
    today = client.get(TODAY).json()
    assert client.post(TODAY, json=body(today)).status_code == 503


def test_a_bad_answer_for_one_experiment_saves_nothing_for_any(db):
    db.rows = [row(A, metrics=[metric("shared"), metric("only_a")]), row(B, metrics=[metric("shared")])]
    today = client.get(TODAY).json()
    answers = {ids(today)["shared"]: 5, ids(today)["only_a"]: 99}
    response = client.post(TODAY, json={"revision": today["revision"], "answers": answers})
    assert response.status_code == 422
    assert response.json()["detail"] == [{"field": ids(today)["only_a"], "message": "Must be between 1 and 10"}]
    assert db.saved == {}


def test_missing_and_unknown_answers_are_field_errors(db):
    db.rows = [row(A)]
    today = client.get(TODAY).json()
    response = client.post(TODAY, json={"revision": today["revision"], "answers": {"nope": 1}})
    assert response.status_code == 422
    fields = {e["field"] for e in response.json()["detail"]}
    assert fields == {"nope", ids(today)["energy"]}


def test_the_change_answer_is_per_experiment_and_required_only_in_its_test_phase(db):
    db.rows = [row(A, days_ago=0), row(B, days_ago=4)]
    today = client.get(TODAY).json()
    response = client.post(TODAY, json=body(today))
    assert response.json()["detail"] == [{"field": f"change:{B}", "message": "Required on a test day"}]
    response = client.post(TODAY, json=body(today, changes={A: True, B: True}))
    assert response.json()["detail"] == [{"field": f"change:{A}", "message": "This experiment is on a normal day"}]
    assert db.saved == {}


def test_a_stale_form_is_refused_rather_than_saved_on_the_wrong_day(db):
    db.rows = [row(A), row(B)]
    today = client.get(TODAY).json()
    db.rows = [row(A, days_ago=2), row(B)]
    response = client.post(TODAY, json=body(today))
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "checkin_changed"
    assert db.saved == {}


def test_a_new_experiment_makes_the_form_stale(db):
    db.rows = [row(A)]
    today = client.get(TODAY).json()
    db.rows = [row(A), row(B)]
    assert client.post(TODAY, json=body(today)).json()["detail"]["code"] == "checkin_changed"


def test_nothing_due_is_409(db):
    today = client.get(TODAY).json()
    assert client.post(TODAY, json=body(today)).status_code == 409


def test_body_cannot_name_a_day_or_owner(db):
    db.rows = [row(A)]
    today = client.get(TODAY).json()
    assert client.post(TODAY, json={**body(today), "day_number": 3}).status_code == 422


def test_usage_events_distinguish_first_save_update_and_baseline(db, monkeypatch):
    from app.services import app_events
    events = []
    monkeypatch.setattr(app_events, "insert", lambda p, n, e: events.append({"profile_id": p, "event_name": n, "experiment_id": e}))
    db.rows = [row(A, days_ago=2)]
    db.saved[(A, 1)] = {"day_number": 1}
    db.saved[(A, 2)] = {"day_number": 2}
    today = client.get(TODAY).json()
    assert client.post(TODAY, json=body(today)).status_code == 200
    assert [e["event_name"] for e in events] == ["checkin_saved", "baseline_completed"]
    assert client.post(TODAY, json=body(today)).status_code == 200
    assert [e["event_name"] for e in events] == ["checkin_saved", "baseline_completed", "checkin_updated"]
    assert all(set(e) == {"profile_id", "event_name", "experiment_id"} for e in events)


def test_event_insert_failure_does_not_break_checkin(db, monkeypatch, caplog):
    from app.services import app_events
    db.rows = [row(A)]
    today = client.get(TODAY).json()
    monkeypatch.setattr(app_events, "insert", Mock(side_effect=RuntimeError("private answer")))
    response = client.post(TODAY, json=body(today))
    assert response.status_code == 200
    assert db.saved
    assert "app_event_not_recorded" in caplog.text
    assert "private answer" not in caplog.text
