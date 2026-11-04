"""Every OpenRouter call writes one row, and paid work stops at the daily limit."""
import asyncio
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.config import Settings, settings
from app.integrations import ai_usage, jev, openrouter
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import ai_calls, experiments, profiles, reports
from app.schemas.classification import Classification
from tests.test_propose import CLASSIFICATION, PREDICTION, PROFILE_ROW, PROPOSAL, USER_ID

PROFILE_ID = PROFILE_ROW["id"]
real_insert = ai_calls.insert
real_count_since = ai_calls.count_since
client = TestClient(app)


class FakeOpenRouter:
    """Replaces only the HTTP post, so the real validation, retry and recording all run."""

    def __init__(self):
        self.posts: list[str] = []
        self.design = [{"proposal": PROPOSAL, "prediction": PREDICTION}]
        self.classification = {k: {"choice": v} for k, v in CLASSIFICATION.items()}

    async def __call__(self, task, model, url, payload, timeout):
        self.posts.append(task)
        if task == "classification":
            if isinstance(self.classification, Exception):
                raise self.classification
            return {"answers": self.classification}
        reply = self.design[min(self.posts.count(task), len(self.design)) - 1]
        if isinstance(reply, Exception):
            raise reply
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return {"choices": [{"message": {"content": content}}]}


@pytest.fixture
def ai(monkeypatch):
    fake = FakeOpenRouter()
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    monkeypatch.setattr(openrouter, "_post", fake)
    monkeypatch.setattr(settings, "openrouter_api_key", "test")
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)
    monkeypatch.setattr(experiments, "list_completed", lambda *_a: [])
    monkeypatch.setattr(experiments, "list_for_profile", lambda *_a: [])
    monkeypatch.setattr(experiments, "supports_personal_guess", lambda _p: True)
    monkeypatch.setattr(reports, "list_for_experiments", lambda _ids: [])
    yield fake
    app.dependency_overrides.clear()


def propose():
    return client.post("/api/experiments/propose", json={"question": "Does walking after dinner improve my sleep?"})


def summary(rows):
    return [(row["kind"], row["status"]) for row in rows]


def test_a_proposal_writes_one_row_per_call_with_no_prompt_text(ai, ai_call_rows):
    assert propose().status_code == 200
    assert summary(ai_call_rows.rows) == [("other", "ok"), ("propose", "ok")]
    row = ai_call_rows.rows[1]
    assert row["profile_id"] == PROFILE_ID
    assert row["model"] == settings.openrouter_reasoning_model
    assert isinstance(row["latency_ms"], int) and row["latency_ms"] >= 0
    assert set(row) == {"profile_id", "kind", "model", "status", "latency_ms", "created_at"}


def test_a_validation_retry_is_one_row_for_each_call(ai, ai_call_rows):
    ai.design = ["not json", {"proposal": PROPOSAL, "prediction": PREDICTION}]
    assert propose().status_code == 200
    assert summary(ai_call_rows.rows)[1:] == [("propose", "retry"), ("propose", "ok")]


def test_output_that_stays_invalid_is_recorded(ai, ai_call_rows):
    ai.design = ["not json"]
    assert propose().status_code == 502
    assert summary(ai_call_rows.rows)[1:] == [("propose", "retry"), ("propose", "invalid")]


def test_an_unreachable_service_is_recorded(ai, ai_call_rows):
    ai.design = [openrouter.AIUnavailable("experiment_design")]
    assert propose().status_code == 503
    assert summary(ai_call_rows.rows)[1:] == [("propose", "error")]


def test_the_jev_fallback_writes_a_row_for_both_calls(ai, ai_call_rows, monkeypatch):
    ai.classification = openrouter.AIUnavailable("classification")
    ai.design = [CLASSIFICATION]
    with ai_usage.for_profile(PROFILE_ID):
        assert asyncio.run(jev.classify("Does walking help?")) == Classification.model_validate(CLASSIFICATION)
    assert summary(ai_call_rows.rows) == [("other", "error"), ("other", "ok")]


def test_the_sixth_proposal_of_the_day_is_429_with_no_paid_call(ai, ai_call_rows):
    for _ in range(5):
        assert propose().status_code == 200
    ai.posts.clear()
    response = propose()
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "ai_daily_limit"
    assert response.json()["detail"]["limit"] == 5
    assert "tomorrow" in response.json()["detail"]["message"]
    assert ai.posts == []


def test_calls_that_earned_nothing_or_came_before_today_do_not_use_up_the_limit(ai, ai_call_rows):
    yesterday = datetime.now(UTC) - timedelta(days=1)
    for _ in range(5):
        ai_call_rows.rows.append({"profile_id": PROFILE_ID, "kind": "propose", "status": "ok", "created_at": yesterday})
        ai_call_rows.rows.append({"profile_id": PROFILE_ID, "kind": "propose", "status": "error", "created_at": datetime.now(UTC)})
        ai_call_rows.rows.append({"profile_id": PROFILE_ID, "kind": "propose", "status": "retry", "created_at": datetime.now(UTC)})
        ai_call_rows.rows.append({"profile_id": "someone-else", "kind": "propose", "status": "ok", "created_at": datetime.now(UTC)})
    assert propose().status_code == 200


def test_the_limit_comes_from_settings(ai, monkeypatch):
    monkeypatch.setattr(settings, "ai_daily_limit_propose", 1)
    assert propose().status_code == 200
    assert propose().status_code == 429


def test_limits_default_to_five_and_three_and_blank_means_default():
    blank = Settings(_env_file=None, ai_daily_limit_propose="", ai_daily_limit_report="")
    assert (blank.ai_daily_limit_propose, blank.ai_daily_limit_report) == (5, 3)
    assert Settings(_env_file=None, ai_daily_limit_propose="9").ai_daily_limit_propose == 9


def test_a_limit_of_zero_refuses_the_first_proposal_with_no_paid_call(ai, monkeypatch):
    """How to see the message without paying: AI_DAILY_LIMIT_PROPOSE=0."""
    assert Settings(_env_file=None, ai_daily_limit_propose="0").ai_daily_limit_propose == 0
    monkeypatch.setattr(settings, "ai_daily_limit_propose", 0)
    response = propose()
    assert response.status_code == 429
    assert response.json()["detail"]["message"] == "You've used all of today's experiment plans. Please come back tomorrow."
    assert ai.posts == []


def test_a_missing_table_never_blocks_a_proposal(ai, monkeypatch, ai_call_rows):
    """The app must keep working if this deploys before the migration is applied."""
    def down(*_a, **_k):
        raise SupabaseUnavailable("no such table")
    monkeypatch.setattr(ai_calls, "count_since", down)
    monkeypatch.setattr(ai_calls, "insert", down)
    assert propose().status_code == 200


def test_the_repository_only_sends_the_allowed_columns(monkeypatch):
    seen = {}
    def rest(method, table, **kwargs):
        seen.update(method=method, table=table, **kwargs)
        return [{"id": "row-1"}, {"id": "row-2"}]
    monkeypatch.setattr(ai_calls, "rest_request", rest)
    real_insert("profile-1", "report", "model-1", "ok", 12)
    assert seen["table"] == "ai_calls"
    assert seen["json"] == {"profile_id": "profile-1", "kind": "report", "model": "model-1", "status": "ok", "latency_ms": 12}

    since = datetime(2026, 11, 4, tzinfo=UTC)
    assert real_count_since("profile-1", "report", since, 3) == 2
    assert seen["params"]["profile_id"] == "eq.profile-1"
    assert seen["params"]["kind"] == "eq.report"
    assert seen["params"]["status"] == "in.(ok,invalid)"
    assert seen["params"]["created_at"] == "gte.2026-11-04T00:00:00+00:00"
    assert seen["params"]["limit"] == "3"
