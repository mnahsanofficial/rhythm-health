"""Request logs, the health check and optional error reporting."""
import json
import logging

import pytest
from fastapi.testclient import TestClient

from app import monitoring
from app.config import Settings
from app.integrations import supabase
from app.main import app

client = TestClient(app, raise_server_exceptions=False)
SECRET = "very-secret-token"


def request_logs(caplog):
    return [json.loads(r.getMessage()) for r in caplog.records if r.name == "app.request"]


@pytest.fixture
def logs(caplog):
    caplog.set_level(logging.INFO, logger="app.request")
    return caplog


def test_a_request_logs_its_id_route_status_and_latency(logs):
    response = client.get("/health")
    entry = request_logs(logs)[-1]
    assert set(entry) == {"event", "request_id", "method", "route", "status", "latency_ms"}
    assert entry["event"] == "request"
    assert entry["method"] == "GET"
    assert entry["route"] == "/health"
    assert entry["status"] == 200
    assert isinstance(entry["latency_ms"], int)
    assert entry["request_id"] == response.headers["x-request-id"]


def test_the_route_is_the_template_so_ids_stay_out_of_the_logs(logs):
    client.get("/api/experiments/11111111-1111-1111-1111-111111111111")
    entry = request_logs(logs)[-1]
    assert entry["route"] == "/api/experiments/{experiment_id}"
    assert "11111111" not in json.dumps(entry)


def test_an_unknown_path_is_not_logged_as_typed(logs):
    client.get("/wp-admin/secret-path")
    entry = request_logs(logs)[-1]
    assert entry["route"] == "unmatched"
    assert entry["status"] == 404


def test_tokens_query_strings_and_bodies_never_reach_the_logs(logs):
    client.post(
        f"/api/experiments/propose?token={SECRET}",
        headers={"Authorization": f"Bearer {SECRET}", "Cookie": f"session={SECRET}"},
        json={"question": SECRET},
    )
    assert request_logs(logs)
    assert SECRET not in logs.text


def test_every_request_gets_its_own_id_and_a_sent_one_is_ignored(logs):
    first = client.get("/health", headers={"X-Request-ID": "injected\nline"})
    second = client.get("/health")
    assert "injected" not in first.headers["x-request-id"]
    assert first.headers["x-request-id"] != second.headers["x-request-id"]


def test_a_crash_is_logged_as_a_500(logs, monkeypatch):
    def boom():
        raise RuntimeError(SECRET)
    monkeypatch.setattr(supabase, "check_connection", boom)
    assert client.get("/health/supabase").status_code == 500
    entry = request_logs(logs)[-1]
    assert entry["status"] == 500
    assert entry["route"] == "/health/supabase"


def test_api_health_reports_a_working_database(monkeypatch):
    monkeypatch.setattr(supabase, "check_connection", lambda: True)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_api_health_is_503_when_the_database_is_down(monkeypatch):
    monkeypatch.setattr(supabase, "check_connection", lambda: False)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


def test_sentry_does_nothing_without_a_dsn(monkeypatch):
    def must_not_load():
        raise AssertionError("sentry_sdk should not load")
    monkeypatch.setattr(monitoring, "_load_sentry", must_not_load)
    assert monitoring.init_error_reporting("") is False
    assert Settings(_env_file=None).sentry_dsn == ""


def test_sentry_starts_with_a_dsn_and_sends_no_personal_data(monkeypatch):
    seen = {}
    class FakeSentry:
        @staticmethod
        def init(**kwargs):
            seen.update(kwargs)
    monkeypatch.setattr(monitoring, "_load_sentry", lambda: FakeSentry)
    assert monitoring.init_error_reporting("https://public@example.invalid/1") is True
    assert seen["dsn"] == "https://public@example.invalid/1"
    assert seen["send_default_pii"] is False
    assert seen["traces_sample_rate"] == 0
    assert seen["max_request_body_size"] == "never"


def test_sentry_strips_headers_query_and_cookies_before_sending():
    event = {"request": {"url": "http://x/a", "headers": {"Authorization": SECRET}, "query_string": SECRET, "cookies": SECRET, "data": SECRET}}
    cleaned = monitoring.scrub_event(event, {})
    assert SECRET not in json.dumps(cleaned)
    assert cleaned["request"]["url"] == "http://x/a"
