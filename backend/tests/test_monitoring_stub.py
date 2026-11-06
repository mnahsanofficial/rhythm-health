"""The drill's successful plan is synthetic and never needs a paid provider."""
import json

from app.schemas.proposal import ProposalWithPrediction
from scripts.monitoring_stub import QUESTION, response_for


def test_plan_stub_returns_valid_design_with_explicit_test_label():
    status, body = response_for('plan', '/api/v1/chat/completions')
    assert status == 200
    envelope = json.loads(body)
    plan = ProposalWithPrediction.model_validate_json(envelope['choices'][0]['message']['content'])
    assert plan.proposal.question == QUESTION
    assert QUESTION.startswith('Monitoring drill:')


def test_plan_classification_and_fail_closed_default():
    status, body = response_for('plan', '/api/alpha/decisions')
    assert status == 200
    assert json.loads(body)['answers']['risk']['choice'] == 'low'
    assert response_for('happy', '/api/v1/chat/completions')[0] == 500
    assert response_for('ai-down', '/api/v1/chat/completions')[0] == 500
    status, body = response_for('ai-invalid', '/api/v1/chat/completions')
    assert status == 200 and body == b'not json'
