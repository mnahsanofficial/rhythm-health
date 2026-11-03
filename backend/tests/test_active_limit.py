"""The three-active limit at the API. Supabase and the AI are faked; nothing paid runs."""
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.main import app
from app.repositories import experiments, profiles
from app.services import experiment_limit, proposal as proposal_service
from tests.test_experiments import ALICE, BOB, BODY, FakeDb

client = TestClient(app)
PROPOSE = "/api/experiments/propose"
QUESTION = {"question": "Does a 20-minute walk after dinner improve my morning energy?"}
MIGRATION = Path(__file__).resolve().parents[2] / "supabase/migrations/20261104000000_active_experiment_limit.sql"


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "create", fake.create)
    monkeypatch.setattr(experiments, "list_for_profile", fake.list_for_profile)
    monkeypatch.setattr(experiments, "get", fake.get)
    monkeypatch.setattr(experiments, "start", fake.start)
    monkeypatch.setattr(experiments, "supports_personal_guess", lambda _profile: True)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def paid(monkeypatch):
    """Any path that reaches the AI fails the test."""
    call = Mock(side_effect=AssertionError("No AI call may happen at the limit"))
    monkeypatch.setattr(proposal_service, "propose", call, raising=False)
    from app.api import experiments as api
    monkeypatch.setattr(api, "propose", call)
    return call


def start_new():
    saved = client.post("/api/experiments", json=BODY).json()
    return saved, client.post(f"/api/experiments/{saved['id']}/start")


def fill(count=3):
    for _ in range(count):
        assert start_new()[1].status_code == 200


def assert_limit_detail(response):
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "active_limit_reached"
    assert detail["limit"] == 3
    assert "3" in detail["message"]


def test_python_and_sql_limits_match():
    assert experiment_limit.MAX_ACTIVE_EXPERIMENTS == 3
    assert f">= {experiment_limit.MAX_ACTIVE_EXPERIMENTS}" in MIGRATION.read_text()


def test_up_to_three_can_run_and_the_fourth_is_refused(db):
    fill(3)
    saved, response = start_new()
    assert_limit_detail(response)
    assert client.get(f"/api/experiments/{saved['id']}").json()["status"] == "proposed"
    active = client.get("/api/experiments?status=active").json()
    assert len(active) == 3


def test_a_race_that_reaches_the_database_is_the_same_409(db, monkeypatch):
    saved = client.post("/api/experiments", json=BODY).json()
    monkeypatch.setattr(experiments, "start", Mock(side_effect=SupabaseConflict()))
    assert_limit_detail(client.post(f"/api/experiments/{saved['id']}/start"))


def test_finishing_one_frees_a_slot(db):
    fill(3)
    db.rows[0]["status"] = "completed"
    assert start_new()[1].status_code == 200


def test_one_persons_experiments_do_not_use_another_persons_slots(db):
    fill(3)
    db.current = BOB
    assert start_new()[1].status_code == 200


def test_propose_at_the_limit_is_refused_before_any_paid_call(db, paid):
    fill(3)
    assert_limit_detail(client.post(PROPOSE, json=QUESTION))
    paid.assert_not_called()


def test_propose_below_the_limit_reaches_the_designer(db, paid):
    fill(2)
    with pytest.raises(AssertionError, match="No AI call"):
        client.post(PROPOSE, json=QUESTION)
    paid.assert_called_once()


def test_propose_stops_before_the_paid_call_if_the_limit_cannot_be_read(db, paid, monkeypatch):
    monkeypatch.setattr(experiments, "list_for_profile", Mock(side_effect=SupabaseUnavailable("down")))
    assert client.post(PROPOSE, json=QUESTION).status_code == 503
    paid.assert_not_called()


@pytest.mark.parametrize("running,can_start", [(0, True), (2, True), (3, False)])
def test_capacity_reports_what_the_clients_need(db, running, can_start):
    fill(running)
    response = client.get("/api/experiments/capacity")
    assert response.status_code == 200
    assert response.json() == {"active": running, "limit": 3, "can_start": can_start}


def test_capacity_counts_only_the_signed_in_person(db):
    fill(3)
    db.current = BOB
    assert client.get("/api/experiments/capacity").json()["active"] == 0


def test_capacity_needs_auth_a_profile_and_a_database(db, monkeypatch):
    db.users_with_profile.discard(ALICE)
    assert client.get("/api/experiments/capacity").status_code == 409
    db.users_with_profile.add(ALICE)
    monkeypatch.setattr(experiments, "list_for_profile", Mock(side_effect=SupabaseUnavailable("down")))
    assert client.get("/api/experiments/capacity").status_code == 503
    app.dependency_overrides.clear()
    assert client.get("/api/experiments/capacity").status_code == 401
