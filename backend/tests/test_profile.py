import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import profiles
from app.schemas.profile import ProfileIn

USER_ID = "11111111-1111-1111-1111-111111111111"

BODY = {
    "age_range": "25-34",
    "usual_sleep_hours": 8,
    "usual_sleep_schedule": {"bedtime": "23:30", "wake_time": "07:30"},
    "activity_level": "lightly_active",
    "goals": ["better morning energy", "better focus"],
    "regular_habits": ["coffee around 9 AM"],
    "constraints": ["cannot exercise before work"],
}


class FakeDb:
    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.calls = 0

    def get_by_user_id(self, user_id):
        return self.rows.get(user_id)

    def upsert(self, user_id, values):
        self.calls += 1
        row = self.rows.get(user_id, {"id": f"00000000-0000-0000-0000-00000000000{self.calls}"})
        row = {
            **row,
            **values,
            "user_id": user_id,
            "created_at": "2026-10-28T10:00:00+00:00",
            "updated_at": "2026-10-28T10:00:00+00:00",
        }
        self.rows[user_id] = row
        return row


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_by_user_id)
    monkeypatch.setattr(profiles, "upsert", fake.upsert)
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    yield fake
    app.dependency_overrides.clear()


client = TestClient(app)


def test_unauthenticated_is_401():
    assert client.get("/api/profile").status_code == 401
    assert client.put("/api/profile", json=BODY).status_code == 401


def test_get_missing_profile_is_404(db):
    assert client.get("/api/profile").status_code == 404


def test_put_creates_then_updates_same_row(db):
    first = client.put("/api/profile", json=BODY)
    assert first.status_code == 200
    assert "user_id" not in first.json()

    second = client.put("/api/profile", json={**BODY, "usual_sleep_hours": 7.5})
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["usual_sleep_hours"] == 7.5
    assert len(db.rows) == 1

    assert client.get("/api/profile").json() == second.json()


def test_put_uses_token_user_and_rejects_client_user_id(db):
    res = client.put("/api/profile", json={**BODY, "user_id": "someone-else"})
    assert res.status_code == 422
    assert db.rows == {}

    assert client.put("/api/profile", json=BODY).status_code == 200
    assert list(db.rows) == [USER_ID]


def test_database_down_is_503(db, monkeypatch):
    def boom(*_a):
        raise SupabaseUnavailable("down")

    monkeypatch.setattr(profiles, "get_by_user_id", boom)
    assert client.get("/api/profile").status_code == 503


@pytest.mark.parametrize(
    "change",
    [
        {"age_range": "12-17"},
        {"usual_sleep_hours": 0},
        {"usual_sleep_hours": 20},
        {"usual_sleep_schedule": {"bedtime": "25:00", "wake_time": "07:30"}},
        {"usual_sleep_schedule": {"bedtime": "23:30"}},
        {"activity_level": "athlete"},
        {"goals": [""]},
        {"goals": ["x"] * 21},
        {"goals": "better focus"},
    ],
)
def test_invalid_fields_rejected(change):
    with pytest.raises(ValidationError):
        ProfileIn(**{**BODY, **change})


def test_missing_field_rejected():
    body = {k: v for k, v in BODY.items() if k != "goals"}
    with pytest.raises(ValidationError):
        ProfileIn(**body)
