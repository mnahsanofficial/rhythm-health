"""Monitoring failures must not disclose answers or block successful actions."""
import json
from datetime import UTC, datetime
from unittest.mock import Mock

from fastapi.testclient import TestClient

from app import monitoring
from app.config import settings
from app.main import app
from app.services import app_events, metrics

client = TestClient(app, raise_server_exceptions=False)


def test_drill_is_disabled_by_default_and_in_production(monkeypatch):
    monkeypatch.setattr(settings, "dev_failure_drill", False)
    assert client.get("/api/dev/failure-drill").status_code == 404
    monkeypatch.setattr(settings, "dev_failure_drill", True)
    monkeypatch.setattr(settings, "app_environment", "production")
    assert client.get("/api/dev/failure-drill").status_code == 404


def test_drill_returns_friendly_error_and_correlated_header(monkeypatch, caplog):
    monkeypatch.setattr(settings, "dev_failure_drill", True)
    monkeypatch.setattr(settings, "app_environment", "development")
    report = Mock()
    monkeypatch.setattr(monitoring, "report_failure", report)
    response = client.get("/api/dev/failure-drill")
    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong. Please try again."}
    request_id = response.headers["x-request-id"]
    logs = [json.loads(r.message) for r in caplog.records if r.name == "app.request"]
    assert logs[-1]["request_id"] == request_id
    assert logs[-1]["status"] == 500
    assert report.call_args.args[0] == "unhandled_error"


def test_sentry_allowlist_removes_secrets_even_in_exception_text():
    secret = "token-or-health-answer"
    event = {
        "event_id": "a" * 32, "platform": "python", "release": "abc123",
        "environment": "development", "tags": {"request_id": "b" * 32, "answer": secret},
        "request": {"url": "https://example.com/" + secret + "?token=" + secret},
        "user": {"id": secret}, "extra": {"answer": secret},
        "breadcrumbs": [{"message": secret}], "message": secret,
        "exception": {"values": [{"type": "ValueError", "value": secret,
            "stacktrace": {"frames": [{"filename": "/private/" + secret, "function": "save", "vars": {"answer": secret}}]}}]},
    }
    clean = monitoring.scrub_event(event, {})
    assert secret not in json.dumps(clean)
    assert clean["tags"]["request_id"] == "b" * 32
    assert clean["release"] == "abc123"


def test_event_write_failure_is_best_effort(monkeypatch, caplog):
    def fail(*args, **kwargs):
        raise RuntimeError("a private database response")
    monkeypatch.setattr(app_events, "insert", fail)
    app_events.record("profile", "checkin_saved", "experiment")
    assert "app_event_not_recorded" in caplog.text
    assert "private database" not in caplog.text


def test_metrics_count_updates_once_and_exclude_samples():
    now = datetime(2026, 11, 6, 12, tzinfo=UTC)
    events = [
        {"profile_id": "p", "event_name": "checkin_saved", "created_at": "2026-11-06T01:00:00+00:00"},
        {"profile_id": "p", "event_name": "checkin_updated", "created_at": "2026-11-06T02:00:00+00:00"},
    ]
    experiments = [{"id": "e", "started_at": "2026-11-04T12:00:00+00:00", "baseline_days": 3, "intervention_days": 7, "status": "active", "is_seeded": False}]
    checkins = [{"experiment_id": "e", "day_number": 1}, {"experiment_id": "e", "day_number": 1}, {"experiment_id": "e", "day_number": 3}, {"experiment_id": "sample", "day_number": 1}]
    result = metrics.summarize(events, experiments, checkins, now)
    assert result["counts"]["checkin_saved"] == 1
    assert result["daily_active_users"]["2026-11-06"] == 1
    assert result["checkin_completion"]["days_recorded"] == 2
    assert result["checkin_completion"]["days_elapsed"] == 3
    assert result["checkin_completion"]["rate"] == 2 / 3


def test_expected_validation_and_daily_cap_do_not_report(monkeypatch):
    from app.auth.supabase import get_current_user
    from app.repositories import profiles, experiments
    from tests.test_propose import PROFILE_ROW
    report = Mock()
    monkeypatch.setattr(monitoring, "report_failure", report)
    app.dependency_overrides[get_current_user] = lambda: "test-user"
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _: PROFILE_ROW)
    monkeypatch.setattr(experiments, "list_for_profile", lambda *_: [])
    monkeypatch.setattr(settings, "ai_daily_limit_propose", 0)
    try:
        assert client.post("/api/checkins/today", json={"unexpected": "private"}).status_code == 422
        assert client.post("/api/experiments/propose", json={"question": "Does a short walk help sleep?"}).status_code == 429
        report.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_real_sentry_transport_receives_only_scrubbed_correlated_event(monkeypatch):
    import sentry_sdk
    from sentry_sdk.transport import Transport
    captured = []
    class InMemory(Transport):
        def capture_envelope(self, envelope):
            for item in envelope.items:
                if item.type == "event":
                    captured.append(item.payload.json)
    sentry_sdk.init(dsn="https://public@example.invalid/1", transport=InMemory,
                    default_integrations=False, before_send=monitoring.scrub_event,
                    environment="development", release="abc123")
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@example.invalid/1")
    monkeypatch.setattr(settings, "dev_failure_drill", True)
    monkeypatch.setattr(settings, "app_environment", "development")
    try:
        response = client.get("/api/dev/failure-drill?token=private", headers={"Authorization": "Bearer private"})
        assert len(captured) == 1
        event = captured[0]
        assert event["tags"]["request_id"] == response.headers["x-request-id"]
        assert event["release"] == "abc123"
        assert event["environment"] == "development"
        assert "private" not in json.dumps(event)
    finally:
        sentry_sdk.init(dsn=None, default_integrations=False)


def test_web_can_read_the_request_id_even_on_an_unhandled_500(monkeypatch):
    monkeypatch.setattr(settings, "dev_failure_drill", True)
    monkeypatch.setattr(settings, "app_environment", "development")
    response = client.get("/api/dev/failure-drill", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "x-request-id" in response.headers["access-control-expose-headers"].lower()


def test_profile_requests_log_only_a_profile_hash(monkeypatch, caplog):
    from app.auth.supabase import get_current_user
    from app.repositories import profiles
    from tests.test_propose import PROFILE_ROW
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _: PROFILE_ROW)
    app.dependency_overrides[get_current_user] = lambda: "test-user"
    try:
        assert client.get("/api/profile").status_code == 200
        entries = [json.loads(r.message) for r in caplog.records if r.name == "app.request"]
        assert len(entries[-1]["profile_hash"]) == 24
        assert str(PROFILE_ROW["id"]) not in caplog.text
    finally:
        app.dependency_overrides.clear()
