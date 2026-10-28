import itertools

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
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
