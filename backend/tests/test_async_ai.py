"""The async OpenRouter client, its one retry, and independent reads running together."""
import asyncio
import threading

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.auth.supabase import get_current_user
from app.config import settings
from app.integrations import ai_usage, concurrency, openrouter
from app.main import app
from app.repositories import checkins, experiments, profiles, reports
from tests.test_completion import EXP_ID, FakeDb
from tests.test_propose import CLASSIFICATION, PREDICTION, PROFILE_ROW, PROPOSAL


class Tiny(BaseModel):
    ok: bool


REAL_CLIENT = httpx.AsyncClient
GOOD = {"choices": [{"message": {"content": '{"ok": true}'}}]}


@pytest.fixture
def transport(monkeypatch):
    """Answers each OpenRouter request in turn from a script. Nothing leaves the machine."""
    monkeypatch.setattr(settings, "openrouter_api_key", "test")
    monkeypatch.setattr(openrouter, "RETRY_DELAY_SECONDS", 0)
    state = {"replies": [], "calls": 0, "timeouts": []}

    def handler(request: httpx.Request) -> httpx.Response:
        state["calls"] += 1
        state["timeouts"].append(request.extensions["timeout"])
        reply = state["replies"][min(state["calls"], len(state["replies"])) - 1]
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(openrouter.httpx, "AsyncClient", lambda **kw: REAL_CLIENT(transport=httpx.MockTransport(handler), **kw))
    return state


def complete():
    return asyncio.run(openrouter.complete(task="t", model="m", schema=Tiny, system="s", user="u"))


def test_a_call_returns_the_validated_result(transport):
    transport["replies"] = [httpx.Response(200, json=GOOD)]
    assert complete() == Tiny(ok=True)
    assert transport["calls"] == 1


@pytest.mark.parametrize("failure", [
    httpx.Response(500, json={}),
    httpx.Response(503, json={}),
    httpx.Response(429, json={}),
    httpx.ConnectError("refused"),
    httpx.ConnectTimeout("slow to connect"),
])
def test_one_retry_after_a_failure_that_cost_nothing(transport, failure):
    transport["replies"] = [failure, httpx.Response(200, json=GOOD)]
    assert complete() == Tiny(ok=True)
    assert transport["calls"] == 2


def test_only_one_retry(transport):
    transport["replies"] = [httpx.Response(500, json={})]
    with pytest.raises(openrouter.AIUnavailable):
        complete()
    assert transport["calls"] == 2


def test_a_retried_call_writes_a_row_for_each_try(transport, ai_call_rows):
    async def run():
        with ai_usage.for_profile("profile-1"):
            return await openrouter.complete(task="report_narrative", model="m", schema=Tiny, system="s", user="u")

    transport["replies"] = [httpx.Response(503, json={}), httpx.Response(200, json=GOOD)]
    assert asyncio.run(run()) == Tiny(ok=True)
    assert [(r["kind"], r["status"]) for r in ai_call_rows.rows] == [("report", "error"), ("report", "ok")]


def test_a_call_that_fails_twice_writes_two_rows(transport, ai_call_rows):
    async def run():
        with ai_usage.for_profile("profile-1"):
            return await openrouter.complete(task="report_narrative", model="m", schema=Tiny, system="s", user="u")

    transport["replies"] = [httpx.Response(503, json={})]
    with pytest.raises(openrouter.AIUnavailable):
        asyncio.run(run())
    assert [r["status"] for r in ai_call_rows.rows] == ["error", "error"]


@pytest.mark.parametrize("failure", [
    httpx.Response(400, json={}),
    httpx.Response(401, json={}),
    httpx.ReadTimeout("the model took too long"),
])
def test_no_retry_when_it_would_fail_again_or_may_already_be_paid_for(transport, failure):
    transport["replies"] = [failure]
    with pytest.raises(openrouter.AIUnavailable):
        complete()
    assert transport["calls"] == 1


def test_the_read_timeout_comes_from_settings_and_connecting_fails_fast(transport, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_timeout_seconds", 75.0)
    transport["replies"] = [httpx.Response(200, json=GOOD)]
    complete()
    assert transport["timeouts"][0]["read"] == 75.0
    assert transport["timeouts"][0]["connect"] == 5.0


def test_decisions_are_async_and_keep_their_shorter_read_timeout(transport):
    transport["replies"] = [httpx.Response(200, json={"answers": {"category": {"choice": "sleep"}}})]
    answers = asyncio.run(openrouter.decide(task="t", model="m", state={}, questions={}))
    assert answers == {"category": {"choice": "sleep"}}
    assert transport["timeouts"][0]["read"] == 30


def test_a_slow_ai_call_leaves_the_event_loop_free(transport, monkeypatch):
    """While one person waits on the model, the server can still answer someone else."""
    async def scenario():
        release = asyncio.Event()
        ticks = 0

        async def slow_handler(_request):
            await release.wait()
            return httpx.Response(200, json=GOOD)

        monkeypatch.setattr(openrouter.httpx, "AsyncClient", lambda **kw: REAL_CLIENT(transport=httpx.MockTransport(slow_handler), **kw))
        call = asyncio.create_task(openrouter.complete(task="t", model="m", schema=Tiny, system="s", user="u"))
        for _ in range(5):
            await asyncio.sleep(0)
            ticks += 1
        assert not call.done()
        release.set()
        assert await call == Tiny(ok=True)
        return ticks

    assert asyncio.run(scenario()) == 5


def test_read_together_runs_at_the_same_time_and_keeps_the_order():
    barrier = threading.Barrier(2, timeout=5)

    def read(value):
        barrier.wait()  # Fails with BrokenBarrierError unless both reads are in flight together.
        return value

    assert asyncio.run(concurrency.read_together(lambda: read("a"), lambda: read("b"))) == ("a", "b")


def test_read_together_raises_what_a_read_raised():
    def broken():
        raise ValueError("no")
    with pytest.raises(ValueError):
        asyncio.run(concurrency.read_together(lambda: 1, broken))


# --- through the endpoints ----------------------------------------------------------

client = TestClient(app)


class Together:
    """Records whether two named reads were in flight at the same moment."""

    def __init__(self, count=2):
        self.barrier = threading.Barrier(count, timeout=5)

    def wrap(self, fn):
        def wrapped(*args, **kwargs):
            self.barrier.wait()
            return fn(*args, **kwargs)
        return wrapped


@pytest.fixture
def report_db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, "get_by_user_id", fake.get_profile)
    monkeypatch.setattr(experiments, "get", fake.get_experiment)
    monkeypatch.setattr(experiments, "complete", fake.complete)
    monkeypatch.setattr(experiments, "list_for_profile", lambda *_a: [])
    monkeypatch.setattr(checkins, "list_for_experiment", fake.list_checkins)
    monkeypatch.setattr(reports, "upsert", fake.upsert_report)
    monkeypatch.setattr(reports, "get", fake.get_report)
    monkeypatch.setattr(reports, "save_narrative", fake.save_narrative)
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


def test_completing_reads_checkins_and_other_experiments_together(report_db, monkeypatch):
    together = Together()
    monkeypatch.setattr(checkins, "list_for_experiment", together.wrap(report_db.list_checkins))
    monkeypatch.setattr(experiments, "list_for_profile", together.wrap(lambda *_a: []))
    assert client.post(f"/api/experiments/{EXP_ID}/complete").status_code == 200


def test_reading_a_report_reads_the_report_and_checkins_together(report_db, monkeypatch):
    assert client.post(f"/api/experiments/{EXP_ID}/complete").status_code == 200
    together = Together()
    monkeypatch.setattr(reports, "get", together.wrap(report_db.get_report))
    monkeypatch.setattr(checkins, "list_for_experiment", together.wrap(report_db.list_checkins))
    assert client.get(f"/api/experiments/{EXP_ID}/report").status_code == 200


def test_writing_a_report_reads_its_three_inputs_together(report_db, monkeypatch):
    assert client.post(f"/api/experiments/{EXP_ID}/complete").status_code == 200
    together = Together(3)
    monkeypatch.setattr(reports, "get", together.wrap(report_db.get_report))
    monkeypatch.setattr(checkins, "list_for_experiment", together.wrap(report_db.list_checkins))
    # owned_experiment reads the profile first, on its own; only the later read joins the others.
    real_profile = report_db.get_profile
    seen = {"reads": 0}
    def profile(user_id):
        seen["reads"] += 1
        return real_profile(user_id) if seen["reads"] == 1 else together.barrier.wait() and None or real_profile(user_id)
    monkeypatch.setattr(profiles, "get_by_user_id", profile)
    # The saved report has no narrative, so this reaches the model; refuse it to stop there.
    monkeypatch.setattr(openrouter, "complete", _unavailable)
    assert client.post(f"/api/experiments/{EXP_ID}/report").status_code == 503


async def _unavailable(**_kw):
    raise openrouter.AIUnavailable("down")


def test_a_proposal_reads_history_and_running_questions_together(monkeypatch):
    from app.services import history, proposal
    together = Together()
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)
    monkeypatch.setattr(experiments, "supports_personal_guess", lambda _p: True)
    monkeypatch.setattr(experiments, "list_for_profile", lambda *_a: [])
    monkeypatch.setattr(history, "load", together.wrap(lambda *_a: None))
    monkeypatch.setattr(proposal, "running_questions", together.wrap(lambda *_a: []))

    async def decide(**_kw):
        return {k: {"choice": v} for k, v in CLASSIFICATION.items()}

    async def complete_design(*, schema, **_kw):
        return schema.model_validate({"proposal": PROPOSAL, "prediction": PREDICTION})

    monkeypatch.setattr(openrouter, "decide", decide)
    monkeypatch.setattr(openrouter, "complete", complete_design)
    app.dependency_overrides[get_current_user] = lambda: "user"
    try:
        response = client.post("/api/experiments/propose", json={"question": "Does walking after dinner improve my sleep?"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200


def test_timeout_is_recorded_and_reported_without_retry(transport, ai_call_rows, monkeypatch):
    from unittest.mock import Mock
    report = Mock()
    monkeypatch.setattr(openrouter, "report_failure", report)
    transport["replies"] = [httpx.ReadTimeout("private output")]
    async def run():
        with ai_usage.for_profile("test-profile"):
            await openrouter.complete(task="experiment_design", model="m", schema=Tiny, system="private", user="private")
    with pytest.raises(openrouter.AITimeout):
        asyncio.run(run())
    assert transport["calls"] == 1
    assert [r["status"] for r in ai_call_rows.rows] == ["timeout"]
    report.assert_called_once_with("ai_timeout")


def test_invalid_provider_json_is_invalid_not_network_error(transport, ai_call_rows, monkeypatch):
    from unittest.mock import Mock
    report = Mock()
    monkeypatch.setattr(openrouter, "report_failure", report)
    transport["replies"] = [httpx.Response(200, text="not json")]
    async def run():
        with ai_usage.for_profile("test-profile"):
            await openrouter.complete(task="experiment_design", model="m", schema=Tiny, system="s", user="u")
    with pytest.raises(openrouter.AIInvalidOutput):
        asyncio.run(run())
    assert [r["status"] for r in ai_call_rows.rows] == ["invalid"]
    report.assert_called_once_with("ai_invalid_output")


def test_custom_provider_requires_local_opted_in_drill(transport, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_base_url", "https://example.invalid")
    with pytest.raises(openrouter.AIUnavailable):
        complete()
    assert transport["calls"] == 0
