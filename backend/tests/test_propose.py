import json

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.auth.supabase import get_current_user
from app.config import settings
from app.integrations import openrouter
from app.main import app
from app.repositories import profiles
from app.schemas.classification import Classification
from app.schemas.experiment import ExperimentProposal
from app.schemas.prediction import Prediction
from app.schemas.proposal import ProposalWithPrediction
from app.services import safety

openrouter_complete_real = openrouter.complete

USER_ID = "11111111-1111-1111-1111-111111111111"

PROFILE_ROW = {
    "id": "22222222-2222-2222-2222-222222222222",
    "user_id": USER_ID,
    "age_range": "25-34",
    "usual_sleep_hours": 8,
    "usual_sleep_schedule": {"bedtime": "23:30", "wake_time": "07:30"},
    "activity_level": "lightly_active",
    "goals": ["better morning energy"],
    "regular_habits": ["coffee around 9 AM"],
    "constraints": ["cannot exercise before work"],
    "created_at": "2026-10-28T10:00:00+00:00",
    "updated_at": "2026-10-28T10:00:00+00:00",
}

PROPOSAL = {
    "question": "Does a 20-minute walk after dinner improve my morning energy?",
    "hypothesis": "Light evening activity may improve next-morning energy.",
    "intervention": {
        "action": "Walk for 20 minutes",
        "timing": "Within one hour after dinner",
        "frequency": "daily",
    },
    "baseline_days": 3,
    "intervention_days": 7,
    "metrics": [
        {"key": "morning_energy", "label": "Morning energy", "type": "scale", "min": 1, "max": 10, "primary": True},
        {"key": "sleep_quality", "label": "Sleep quality", "type": "scale", "min": 1, "max": 10, "primary": False},
    ],
    "success_criteria": {"primary_metric": "morning_energy", "minimum_change_percent": 10},
}

PREDICTION = {
    "target_metric": "morning_energy",
    "direction": "increase",
    "expected_change_min": 8,
    "expected_change_max": 15,
    "confidence": "moderate",
    "reasoning": "Adds light movement without reducing sleep.",
    "uncertainty_factors": ["bedtime consistency", "caffeine timing"],
}

CLASSIFICATION = {"category": "sleep", "intent": "behavior_change", "risk": "low"}


class FakeAI:
    """Stands in for openrouter.complete, keyed by task."""

    def __init__(self, **overrides):
        self.outputs = {
            "classification": CLASSIFICATION,
            "experiment_design": {"proposal": PROPOSAL, "prediction": PREDICTION},
        }
        self.outputs.update(overrides)
        self.tasks: list[str] = []

    def __call__(self, *, task, model, schema, system, user, timeout=90):
        self.tasks.append(task)
        out = self.outputs[task]
        if isinstance(out, Exception):
            raise out
        return schema.model_validate(out)


@pytest.fixture
def api(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)

    def install(**overrides):
        fake = FakeAI(**overrides)
        monkeypatch.setattr(openrouter, "complete", fake)

        def decide(**_kw):
            fake.tasks.append("classification")
            out = fake.outputs["classification"]
            if isinstance(out, Exception):
                raise out
            return {k: {"type": "choice", "choice": v} for k, v in out.items()}

        monkeypatch.setattr(openrouter, "decide", decide)
        return fake

    yield install
    app.dependency_overrides.clear()


client = TestClient(app)


def propose(question="Does walking after dinner improve my sleep?", **extra):
    return client.post("/api/experiments/propose", json={"question": question, **extra})


def test_requires_auth():
    assert propose().status_code == 401


def test_happy_path_returns_everything(api):
    fake = api()
    res = propose()
    assert res.status_code == 200
    body = res.json()
    assert body["safety"] == {"allowed": True, "reason": None, "suggested_alternative": None}
    assert body["proposal"]["success_criteria"]["primary_metric"] == "morning_energy"
    assert body["prediction"]["expected_change_min"] == 8
    assert body["classification"] == CLASSIFICATION
    assert fake.tasks == ["classification", "experiment_design"]


def test_rejects_client_user_id(api):
    api()
    assert propose(user_id="x").status_code == 422


def test_no_profile_is_409(api, monkeypatch):
    api()
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: None)
    assert propose().status_code == 409


def test_blocked_classification_stops_generation(api):
    fake = api(classification={**CLASSIFICATION, "risk": "blocked"})
    body = propose("Does something risky help?").json()
    assert body["safety"]["allowed"] is False
    assert body["proposal"] is None and body["prediction"] is None
    assert fake.tasks == ["classification"]


def test_rule_blocks_sleep_restriction_even_if_classifier_says_low(api):
    fake = api()
    body = propose("I want to sleep 3 hours per night for a week").json()
    assert body["safety"]["allowed"] is False
    assert "sleep restriction" in body["safety"]["reason"]
    assert body["safety"]["suggested_alternative"]
    assert "experiment_design" not in fake.tasks


def test_unsafe_generated_proposal_is_blocked(api):
    unsafe = {**PROPOSAL, "intervention": {**PROPOSAL["intervention"], "action": "Fast for 48 hours"}}
    api(experiment_design={"proposal": unsafe, "prediction": PREDICTION})
    body = propose().json()
    assert body["safety"]["allowed"] is False
    assert body["proposal"] is None
    assert body["prediction"] is None


def test_review_risk_is_allowed_with_note(api):
    api(classification={**CLASSIFICATION, "risk": "review"})
    body = propose().json()
    assert body["safety"]["allowed"] is True
    assert body["safety"]["reason"]
    assert body["proposal"] is not None


def test_ai_unavailable_is_503(api):
    api(experiment_design=openrouter.AIUnavailable("x"))
    assert propose().status_code == 503


def test_ai_invalid_output_is_502(api):
    api(experiment_design=openrouter.AIInvalidOutput("x"))
    assert propose().status_code == 502


def test_one_reasoning_call_for_proposal_and_prediction(api):
    fake = api()
    propose()
    assert fake.tasks.count("experiment_design") == 1
    assert "prediction" not in fake.tasks


def test_prediction_for_wrong_metric_is_retried_then_502(api, monkeypatch):
    api()
    monkeypatch.setattr(openrouter, "complete", openrouter_complete_real)
    monkeypatch.setattr(settings, "openrouter_api_key", "test")
    wrong = json.dumps(
        {"proposal": PROPOSAL, "prediction": {**PREDICTION, "target_metric": "something_else"}}
    )
    calls = []
    monkeypatch.setattr(openrouter, "_call", lambda *a: (calls.append(a), wrong)[1])
    assert propose().status_code == 502
    assert len(calls) == 2  # first answer + one retry


def test_combined_schema_requires_prediction_for_primary_metric():
    ProposalWithPrediction(proposal=PROPOSAL, prediction=PREDICTION)
    with pytest.raises(ValidationError):
        ProposalWithPrediction(
            proposal=PROPOSAL, prediction={**PREDICTION, "target_metric": "sleep_quality"}
        )


@pytest.mark.parametrize(
    "text,blocked",
    [
        ("I want to sleep 3 hours per night", True),
        ("Does sleeping 4.5 hours hurt my focus?", True),
        ("Does sleeping 8 hours improve focus?", False),
        ("Would sleeping 7 hours instead of 8 help?", False),
        ("Should I stop taking my medication?", True),
        ("fast for 36 hours", True),
        ("Does a 12 hour overnight fast help?", False),
        ("eat 800 calories a day", True),
        ("Does walking after dinner help?", False),
        ("Does less caffeine improve my focus?", False),
    ],
)
def test_safety_rules(text, blocked):
    assert safety.check_text(text).allowed is (not blocked)


def test_proposal_requires_one_primary_metric():
    bad = {**PROPOSAL, "metrics": [{**m, "primary": False} for m in PROPOSAL["metrics"]]}
    with pytest.raises(ValidationError):
        ExperimentProposal(**bad)


def test_proposal_primary_must_match_criteria():
    bad = {**PROPOSAL, "success_criteria": {**PROPOSAL["success_criteria"], "primary_metric": "other"}}
    with pytest.raises(ValidationError):
        ExperimentProposal(**bad)


def test_prediction_range_must_be_ordered():
    with pytest.raises(ValidationError):
        Prediction(**{**PREDICTION, "expected_change_min": 20, "expected_change_max": 5})


# --- OpenRouter client: validation + one retry -------------------------------


class Tiny(BaseModel):
    n: int


@pytest.fixture
def keyed(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "test")


def test_client_retries_once_then_succeeds(keyed, monkeypatch):
    replies = iter(['{"n": "oops"}', '{"n": 3}'])
    seen = []
    monkeypatch.setattr(
        openrouter, "_call", lambda *a: (seen.append(a[3]), next(replies))[1]
    )
    out = openrouter.complete(task="t", model="m", schema=Tiny, system="s", user="u")
    assert out.n == 3
    assert len(seen) == 2
    assert "rejected" in seen[1][-1]["content"]


def test_client_gives_up_after_second_invalid(keyed, monkeypatch):
    monkeypatch.setattr(openrouter, "_call", lambda *a: "not json")
    with pytest.raises(openrouter.AIInvalidOutput):
        openrouter.complete(task="t", model="m", schema=Tiny, system="s", user="u")


def test_client_without_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    with pytest.raises(openrouter.AIUnavailable):
        openrouter.complete(task="t", model="m", schema=Tiny, system="s", user="u")


def _answers(**choices):
    base = {"category": "sleep", "intent": "question", "risk": "low"}
    base.update(choices)
    return {k: {"type": "choice", "choice": v} for k, v in base.items()}


def test_jev_decisions_map_to_classification(monkeypatch):
    from app.integrations import jev

    seen = {}

    def fake_decide(*, task, model, state, questions, timeout=30):
        seen.update(model=model, state=state, questions=questions)
        return _answers(risk="review")

    monkeypatch.setattr(openrouter, "decide", fake_decide)
    result = jev.classify("Does walking help?")
    assert result == Classification(category="sleep", intent="question", risk="review")
    assert seen["model"] == settings.openrouter_jev_model
    assert seen["state"] == {"question": "Does walking help?"}
    assert set(seen["questions"]) == {"category", "intent", "risk"}


@pytest.mark.parametrize(
    "failure",
    [
        openrouter.AIUnavailable("jev down"),
        {"category": {"type": "choice", "choice": "not_a_category"}, "intent": {"choice": "goal"}, "risk": {"choice": "low"}},
        {"category": {"choice": "sleep"}},
    ],
)
def test_jev_failure_falls_back_to_reasoning_model(monkeypatch, failure):
    from app.integrations import jev

    def fake_decide(**_kw):
        if isinstance(failure, Exception):
            raise failure
        return failure

    models = []

    def fake_complete(*, task, model, schema, system, user, timeout=90):
        models.append(model)
        return schema.model_validate(CLASSIFICATION)

    monkeypatch.setattr(openrouter, "decide", fake_decide)
    monkeypatch.setattr(openrouter, "complete", fake_complete)
    assert jev.classify("q").category == "sleep"
    assert models == [settings.openrouter_reasoning_model]


def test_blank_model_env_uses_default():
    from app.config import Settings

    s = Settings(openrouter_reasoning_model="", openrouter_jev_model="")
    assert s.openrouter_reasoning_model == "anthropic/claude-sonnet-5.5"
    assert s.openrouter_jev_model == "typesafe/jev-router"
