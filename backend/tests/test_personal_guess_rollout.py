"""Rollout through PostgREST's missing-column responses, without any real database."""
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import settings
from app.integrations import supabase
from app.repositories import experiments
from app.main import app
from tests.test_experiments import db, BODY
from tests.test_propose import api, propose

real_supports = getattr(experiments, "supports_personal_guess", None)


def missing_response(monkeypatch, code="PGRST204", column="personal_guess_percent"):
    monkeypatch.setattr(settings, "supabase_url", "https://fake.invalid")
    monkeypatch.setattr(settings, "supabase_service_role_key", "fake")
    def request(method, url, **kwargs):
        return httpx.Response(400, json={"code": code, "message": f"Could not find the '{column}' column of 'experiments' in the schema cache"}, request=httpx.Request(method, url))
    monkeypatch.setattr(httpx, "request", request)


@pytest.mark.parametrize("code", ["PGRST204", "42703"])
def test_propose_works_before_column_exists(api, monkeypatch, code):
    ai = api()
    if real_supports:
        monkeypatch.setattr(experiments, "supports_personal_guess", real_supports)
    missing_response(monkeypatch, code)
    response = propose()
    assert response.status_code == 200
    assert response.json()["personal_guess_available"] is False
    assert ai.tasks == ["classification", "experiment_design"]


def test_propose_advertises_available_column(api, monkeypatch):
    api()
    monkeypatch.setattr(experiments, "supports_personal_guess", lambda _profile: True, raising=False)
    assert propose().json()["personal_guess_available"] is True


def test_lookup_failure_stops_before_paid_call(api, monkeypatch):
    ai = api()
    if real_supports:
        monkeypatch.setattr(experiments, "supports_personal_guess", real_supports)
    missing_response(monkeypatch, column="some_other_column")
    assert propose().status_code == 503
    assert ai.tasks == []


def test_column_disappearing_does_not_silently_drop_guess(db, monkeypatch):
    missing_response(monkeypatch)
    monkeypatch.setattr(experiments, "create", lambda profile, values: supabase.rest_request("POST", "experiments", json=values))
    response = TestClient(app).post("/api/experiments", json={**BODY, "personal_guess_percent": 12})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "personal_guess_unavailable"
    assert not db.rows
