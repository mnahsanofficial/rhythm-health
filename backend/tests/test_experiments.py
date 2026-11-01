import itertools

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.main import app
from app.repositories import experiments, profiles
from tests.test_propose import CLASSIFICATION, PREDICTION, PROPOSAL

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"

BODY = {"category": "sleep", "proposal": PROPOSAL, "prediction": PREDICTION}


class FakeDb:
    def __init__(self):
        self.rows: list[dict] = []
        self.counter = itertools.count(1)
        self.users_with_profile = {ALICE, BOB}
        self.current = ALICE

    def get_profile(self, user_id):
        if user_id not in self.users_with_profile:
            return None
        return {"id": f"profile-of-{user_id}"}

    def create(self, profile_id, values):
        n = next(self.counter)
        row = {
            **values,
            "id": f"00000000-0000-0000-0000-{n:012d}",
            "profile_id": profile_id,
            "started_at": None,
            "completed_at": None,
            "is_seeded": False,
            "created_at": f"2026-10-28T10:00:0{n}+00:00",
            "updated_at": f"2026-10-28T10:00:0{n}+00:00",
        }
        self.rows.insert(0, row)
        return row

    def list_for_profile(self, profile_id, status=None):
        return [
            r for r in self.rows
            if r["profile_id"] == profile_id and (status is None or r["status"] == status)
        ]

    def start(self, profile_id, experiment_id, started_at):
        row = self.get(profile_id, experiment_id)
        if row is None or row["status"] != "proposed":
            return None
        if any(r["profile_id"] == profile_id and r["status"] == "active" for r in self.rows):
            raise SupabaseConflict()  # what the unique index does under a race
        row.update(status="active", started_at=started_at)
        return row

    def get(self, profile_id, experiment_id):
        return next(
            (r for r in self.rows if r["id"] == experiment_id and r["profile_id"] == profile_id),
            None,
        )


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "create", fake.create)
    monkeypatch.setattr(experiments, "list_for_profile", fake.list_for_profile)
    monkeypatch.setattr(experiments, "get", fake.get)
    monkeypatch.setattr(experiments, "start", fake.start)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


client = TestClient(app)


def test_requires_auth():
    assert client.post("/api/experiments", json=BODY).status_code == 401
    assert client.get("/api/experiments").status_code == 401
    assert client.get("/api/experiments/00000000-0000-0000-0000-000000000001").status_code == 401


def test_save_creates_proposed_experiment_for_token_user(db):
    res = client.post("/api/experiments", json=BODY)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "proposed"
    assert body["question"] == PROPOSAL["question"]
    assert body["category"] == "sleep"
    assert body["prediction"]["expected_change_max"] == 15
    assert body["is_seeded"] is False
    assert "profile_id" not in body and "user_id" not in body
    assert db.rows[0]["profile_id"] == f"profile-of-{ALICE}"


@pytest.mark.parametrize("field", ["user_id", "profile_id", "status", "id"])
def test_save_rejects_client_supplied_ownership_and_status(db, field):
    assert client.post("/api/experiments", json={**BODY, field: "x"}).status_code == 422
    assert db.rows == []


def test_save_without_profile_is_409(db):
    db.users_with_profile.discard(ALICE)
    assert client.post("/api/experiments", json=BODY).status_code == 409


def test_save_rejects_prediction_for_other_metric(db):
    body = {**BODY, "prediction": {**PREDICTION, "target_metric": "sleep_quality"}}
    assert client.post("/api/experiments", json=body).status_code == 422
    assert db.rows == []


def test_save_rejects_unsafe_proposal(db):
    unsafe = {**PROPOSAL, "intervention": {**PROPOSAL["intervention"], "action": "Fast for 48 hours"}}
    assert client.post("/api/experiments", json={**BODY, "proposal": unsafe}).status_code == 422
    assert db.rows == []


def test_save_rejects_invalid_category(db):
    assert client.post("/api/experiments", json={**BODY, "category": "astrology"}).status_code == 422


def test_list_returns_only_my_experiments_newest_first(db):
    first = client.post("/api/experiments", json=BODY).json()
    second = client.post("/api/experiments", json=BODY).json()
    db.current = BOB
    bobs = client.post("/api/experiments", json=BODY).json()

    mine = client.get("/api/experiments").json()
    assert [e["id"] for e in mine] == [bobs["id"]]

    db.current = ALICE
    assert [e["id"] for e in client.get("/api/experiments").json()] == [second["id"], first["id"]]


def test_list_status_filter(db):
    client.post("/api/experiments", json=BODY)
    assert len(client.get("/api/experiments?status=proposed").json()) == 1
    assert client.get("/api/experiments?status=active").json() == []
    assert client.get("/api/experiments?status=bogus").status_code == 422


def test_get_one(db):
    saved = client.post("/api/experiments", json=BODY).json()
    res = client.get(f"/api/experiments/{saved['id']}")
    assert res.status_code == 200
    assert res.json() == saved


def test_cannot_open_another_users_experiment(db):
    saved = client.post("/api/experiments", json=BODY).json()
    db.current = BOB
    assert client.get(f"/api/experiments/{saved['id']}").status_code == 404


def test_missing_and_malformed_ids(db):
    assert client.get("/api/experiments/00000000-0000-0000-0000-0000000000ff").status_code == 404
    assert client.get("/api/experiments/not-a-uuid").status_code == 422


def test_database_down_is_503(db, monkeypatch):
    def boom(*_a, **_k):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(experiments, "list_for_profile", boom)
    monkeypatch.setattr(experiments, "create", boom)
    assert client.get("/api/experiments").status_code == 503
    assert client.post("/api/experiments", json=BODY).status_code == 503


# --- start ------------------------------------------------------------------


def save_one():
    return client.post("/api/experiments", json=BODY).json()


def test_start_requires_auth():
    assert client.post("/api/experiments/00000000-0000-0000-0000-000000000001/start").status_code == 401


def test_proposed_experiment_reports_not_started(db):
    assert save_one()["progress"]["state"] == "not_started"


def test_start_activates_and_reports_day_one_baseline(db):
    saved = save_one()
    res = client.post(f"/api/experiments/{saved['id']}/start")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"
    assert body["started_at"] is not None
    assert body["progress"]["state"] == "in_progress"
    assert body["progress"]["day_number"] == 1
    assert body["progress"]["phase"] == "baseline"
    assert body["progress"]["phase_day"] == 1 and body["progress"]["phase_days"] == 3
    assert body["progress"]["total_days"] == 10
    assert body["progress"]["days_remaining"] == 9
    # the definition and prediction are untouched
    assert body["prediction"] == saved["prediction"]
    assert body["hypothesis"] == saved["hypothesis"]


def test_start_twice_is_409(db):
    saved = save_one()
    assert client.post(f"/api/experiments/{saved['id']}/start").status_code == 200
    again = client.post(f"/api/experiments/{saved['id']}/start")
    assert again.status_code == 409
    assert "active" in again.json()["detail"]


def test_only_one_active_experiment(db):
    first, second = save_one(), save_one()
    assert client.post(f"/api/experiments/{first['id']}/start").status_code == 200
    res = client.post(f"/api/experiments/{second['id']}/start")
    assert res.status_code == 409
    assert "already have an active" in res.json()["detail"]
    assert client.get(f"/api/experiments/{second['id']}").json()["status"] == "proposed"


def test_concurrent_start_conflict_is_409(db, monkeypatch):
    saved = save_one()

    def conflict(*_a):
        raise SupabaseConflict()

    monkeypatch.setattr(experiments, "start", conflict)
    assert client.post(f"/api/experiments/{saved['id']}/start").status_code == 409


def test_cannot_start_another_users_experiment(db):
    saved = save_one()
    db.current = BOB
    assert client.post(f"/api/experiments/{saved['id']}/start").status_code == 404
    db.current = ALICE
    assert client.get(f"/api/experiments/{saved['id']}").json()["status"] == "proposed"


def test_users_can_each_have_an_active_experiment(db):
    mine = save_one()
    db.current = BOB
    theirs = save_one()
    assert client.post(f"/api/experiments/{theirs['id']}/start").status_code == 200
    db.current = ALICE
    assert client.post(f"/api/experiments/{mine['id']}/start").status_code == 200


def test_start_missing_or_malformed_id(db):
    assert client.post("/api/experiments/00000000-0000-0000-0000-0000000000ff/start").status_code == 404
    assert client.post("/api/experiments/nope/start").status_code == 422


def test_get_reports_current_day_from_started_at(db):
    from datetime import UTC, datetime, timedelta

    saved = save_one()
    client.post(f"/api/experiments/{saved['id']}/start")
    db.rows[0]["started_at"] = (datetime.now(UTC) - timedelta(days=4, hours=2)).isoformat()
    progress = client.get(f"/api/experiments/{saved['id']}").json()["progress"]
    assert progress["day_number"] == 5
    assert progress["phase"] == "intervention"
    assert progress["phase_day"] == 2 and progress["phase_days"] == 7
    assert client.get("/api/experiments?status=active").json()[0]["progress"]["day_number"] == 5


def test_start_database_down_is_503(db, monkeypatch):
    saved = save_one()

    def boom(*_a):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(experiments, "start", boom)
    assert client.post(f"/api/experiments/{saved['id']}/start").status_code == 503


@pytest.mark.parametrize("guess", [-100, -12.5, 0, 200])
def test_personal_guess_is_saved_and_returned(db, guess):
    res = client.post("/api/experiments", json={**BODY, "personal_guess_percent": guess})
    assert res.status_code == 201
    assert res.json()["personal_guess_percent"] == guess
    assert db.rows[0]["personal_guess_percent"] == guess
    assert client.get(f"/api/experiments/{res.json()['id']}").json()["personal_guess_percent"] == guess


@pytest.mark.parametrize("guess", [-101, 201, True, "10"])
def test_invalid_personal_guess_never_writes(db, guess):
    assert client.post("/api/experiments", json={**BODY, "personal_guess_percent": guess}).status_code == 422
    assert not db.rows


def test_old_database_save_omits_guess_column(db):
    res = client.post("/api/experiments", json=BODY)
    assert res.status_code == 201
    assert res.json()["personal_guess_percent"] is None
    assert "personal_guess_percent" not in db.rows[0]


def test_explicit_null_guess_also_omits_new_column(db):
    res = client.post("/api/experiments", json={**BODY, "personal_guess_percent": None})
    assert res.status_code == 201
    assert "personal_guess_percent" not in db.rows[0]


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_personal_guess_rejects_nonfinite_numbers(value):
    from pydantic import ValidationError
    from app.schemas.proposal import SaveExperimentRequest
    with pytest.raises(ValidationError):
        SaveExperimentRequest.model_validate({**BODY, "personal_guess_percent": value})
