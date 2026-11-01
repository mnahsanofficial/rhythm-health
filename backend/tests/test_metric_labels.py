import pytest
from pydantic import ValidationError
from app.schemas.experiment import Metric
from app.schemas.proposal import ProposalWithPrediction
from app.services.experiment_designer import SYSTEM
from tests.test_propose import PROPOSAL, PREDICTION

BASE = PROPOSAL['metrics'][0]


def test_design_keeps_scale_words_without_changing_bounds():
    metric = {**BASE, 'min_label': 'Drained', 'max_label': 'Full of energy'}
    designed = ProposalWithPrediction.model_validate({
        'proposal': {**PROPOSAL, 'metrics': [metric, PROPOSAL['metrics'][1]]}, 'prediction': PREDICTION,
    })
    saved = designed.proposal.metrics[0].model_dump()
    assert saved['min_label'] == 'Drained' and saved['max_label'] == 'Full of energy'
    assert saved['min'] == 1 and saved['max'] == 10


def test_old_metrics_default_to_no_scale_words():
    metric = Metric.model_validate(BASE)
    assert metric.min_label is None and metric.max_label is None


@pytest.mark.parametrize('word', ['', '   ', 'a' * 81])
def test_scale_words_must_be_short_and_nonblank(word):
    with pytest.raises(ValidationError):
        Metric.model_validate({**BASE, 'min_label': word})


def test_scale_words_are_trimmed_and_partial_labels_remain_optional():
    metric = Metric.model_validate({**BASE, 'min_label': '  Very tired  '})
    assert metric.min_label == 'Very tired' and metric.max_label is None


def test_designer_is_instructed_to_label_the_actual_scale_ends():
    assert 'min_label' in SYSTEM and 'max_label' in SYSTEM
