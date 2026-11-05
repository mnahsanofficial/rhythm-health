"""Short labels: what the phone shows instead of the AI's long sentences. Every case runs without a paid call."""
import pytest
from pydantic import ValidationError

from app.demo import seed
from app.schemas.experiment import Intervention, Metric
from app.schemas.proposal import ProposalWithPrediction
from app.schemas.short_labels import short_label_for, trim_clause, unit_for
from app.services import progress_summary
from app.services.experiment_designer import SYSTEM
from app.services.proposal import running_questions
from app.services.today_checkin import _today
from app.services.progress import with_progress
from tests.test_propose import PREDICTION, PROPOSAL

SCALE = {'type': 'scale', 'min': 1, 'max': 10, 'primary': True}


def metric(**extra):
    return Metric.model_validate({**SCALE, 'key': 'morning_energy', 'label': 'Morning energy', **extra})


def change(action='Walk for 20 minutes', **extra):
    return Intervention.model_validate({'action': action, 'timing': 'After dinner', 'frequency': 'Daily', **extra})


# What the design call may return.

def test_the_design_call_keeps_the_short_labels_it_wrote():
    designed = ProposalWithPrediction.model_validate({
        'proposal': {
            **PROPOSAL,
            'intervention': {**PROPOSAL['intervention'], 'change_short': 'Walk 5 km after dinner', 'short_name': 'Evening walk'},
            'metrics': [{**PROPOSAL['metrics'][0], 'short_label': 'Morning energy'}, PROPOSAL['metrics'][1]],
        },
        'prediction': PREDICTION,
    })
    assert designed.proposal.intervention.change_short == 'Walk 5 km after dinner'
    assert designed.proposal.intervention.short_name == 'Evening walk'
    assert designed.proposal.metrics[0].short_label == 'Morning energy'


@pytest.mark.parametrize('label', ['', '   ', 'One two three four five', 'x' * 25])
def test_a_short_label_over_its_limits_is_rejected(label):
    with pytest.raises(ValidationError):
        metric(short_label=label)


def test_the_longest_label_the_design_asks_for_fits():
    assert metric(short_label='Minutes to fall asleep').short_label == 'Minutes to fall asleep'


@pytest.mark.parametrize('text', ['', 'One two three four five six seven', 'x' * 37])
def test_a_change_short_over_its_limits_is_rejected(text):
    with pytest.raises(ValidationError):
        change(change_short=text)


@pytest.mark.parametrize('text', ['', 'One two three four five six', 'x' * 33])
def test_a_short_name_over_its_limits_is_rejected(text):
    with pytest.raises(ValidationError):
        change(short_name=text)


def test_a_unit_over_its_limit_is_rejected():
    with pytest.raises(ValidationError):
        metric(type='number', min=None, max=None, unit='x' * 9)


def test_the_designer_is_told_about_every_short_field():
    for field in ('short_label', 'unit', 'change_short', 'short_name'):
        assert field in SYSTEM


# Existing experiments: no field stored, no paid call, always an answer.

@pytest.mark.parametrize('key, label, expected', [
    ('morning_energy', 'How energetic do you feel about 1 hour after waking?', 'Morning energy'),
    ('sleep_quality', 'How well did you sleep last night?', 'Sleep quality'),
    ('focus', 'How focused do you feel in the first 2 hours of work?', 'Focus'),
    ('time_to_fall_asleep', 'About how many minutes did it take you to fall asleep?', 'Minutes to fall asleep'),
    ('sleep_onset_minutes', 'About how many minutes did it take you to fall asleep?', 'Minutes to fall asleep'),
])
def test_known_keys_get_their_label(key, label, expected):
    assert short_label_for(key, label) == expected


@pytest.mark.parametrize('key, label, expected', [
    ('energy_after_waking', 'How energetic do you feel about 1 hour after waking?', 'Morning energy'),
    ('work_focus_rating', 'How focused do you feel in the first 2 hours of work?', 'Focus'),
    ('latency_estimate', 'About how many minutes did it take you to fall asleep?', 'Minutes to fall asleep'),
])
def test_an_unknown_key_is_named_from_what_it_measures(key, label, expected):
    assert short_label_for(key, label) == expected


def test_a_short_label_is_kept_as_it_is():
    assert short_label_for('some_measure', 'Evening calm') == 'Evening calm'


def test_a_measure_where_more_is_worse_never_reads_as_the_good_thing():
    assert short_label_for('afternoon_crash', 'How bad was your afternoon energy crash today?') == 'Afternoon crash'


def test_otherwise_the_first_clause_is_trimmed():
    label = short_label_for('q_1_of_the_long_daily_list', 'Your overall day, from morning until bedtime, was it good?')
    assert label == 'Your overall day'


def test_every_fallback_stays_within_the_limits():
    label = short_label_for('q_1_of_the_long_daily_list', 'Supercalifragilisticexpialidocious feelings about absolutely everything today')
    assert len(label) <= 24 and len(label.split()) <= 4 and label


@pytest.mark.parametrize('action, words, chars, expected', [
    ('Walk 5 km at a comfortable steady pace (not intense). Keep everything else the same.', 6, 36, 'Walk 5 km'),
    ('Get 10 minutes of outdoor daylight within 30 minutes of waking', 6, 36, 'Get 10 minutes of outdoor daylight'),
    ('Have one cup of coffee about 8 hours before bedtime', 6, 36, 'Have one cup of coffee'),
    ('Walk for 20 minutes', 6, 36, 'Walk for 20 minutes'),
    ('stop looking at the phone', 6, 36, 'Stop looking at the phone'),
])
def test_a_clause_is_cut_where_it_still_makes_sense(action, words, chars, expected):
    assert trim_clause(action, words, chars) == expected


def test_a_clause_with_no_natural_break_never_ends_on_a_loose_word():
    assert trim_clause('Drink water the whole morning and the whole of the afternoon', 3, 36) == 'Drink water'


def test_a_saved_experiment_with_no_short_fields_still_gets_them():
    intervention = change('Walk 5 km at a comfortable steady pace (not intense). Keep everything else the same.')
    assert intervention.change_short == 'Walk 5 km'
    assert intervention.short_name == 'Walk 5 km'
    saved = metric(label='How energetic do you feel about 1 hour after waking?')
    assert saved.short_label == 'Morning energy'
    assert saved.unit == '/10'


def test_what_was_written_is_never_replaced_by_the_fallback():
    assert change(change_short='Evening walk', short_name='Walk').change_short == 'Evening walk'
    assert metric(short_label='Energy').short_label == 'Energy'


# Units.

@pytest.mark.parametrize('kind, low, high, key, label, given, expected', [
    ('scale', 1, 10, 'energy', 'Energy', None, '/10'),
    ('scale', 0, 5, 'energy', 'Energy', None, '/5'),
    ('scale', 1, 10, 'energy', 'Energy', 'points', '/10'),  # The bound is the fact, whatever the model said.
    ('duration', None, None, 'nap', 'Nap', None, 'min'),
    ('number', None, None, 'time_to_fall_asleep', 'Minutes to fall asleep', None, 'min'),
    ('number', None, None, 'sleep_hours', 'Hours of sleep', None, 'h'),
    ('number', None, None, 'steps', 'Steps', 'steps', 'steps'),
    ('number', None, None, 'cups', 'Cups', None, None),
    ('boolean', None, None, 'walked', 'Walked', 'min', None),
])
def test_the_unit_for_each_kind_of_metric(kind, low, high, key, label, given, expected):
    assert unit_for(kind, low, high, key, label, given) == expected


# The places that send them to the phone.

def _row(**extra):
    return with_progress({
        'id': 'e1', 'status': 'active', 'question': 'Does a walk help?', 'started_at': '2026-11-01T09:00:00+00:00',
        'baseline_days': 3, 'intervention_days': 7, 'is_seeded': False,
        'intervention': {'action': 'Walk 5 km at a comfortable steady pace.', 'timing': 'Evening', 'frequency': 'Daily'},
        'metrics': [{**SCALE, 'key': 'morning_energy', 'label': 'How energetic do you feel?'}],
        **extra,
    })


def test_todays_check_in_sends_the_short_names():
    today = _today([_row()], {'e1': None})
    assert today.experiments[0].change_short == 'Walk 5 km'
    assert today.experiments[0].short_name == 'Walk 5 km'
    assert today.questions[0].metric.short_label == 'Morning energy'
    assert today.questions[0].metric.unit == '/10'


def test_a_new_design_reuses_a_running_questions_short_label(monkeypatch):
    stored = {**SCALE, 'key': 'morning_energy', 'label': 'Morning energy', 'short_label': 'Energy', 'unit': '/10', 'min_label': None, 'max_label': None}
    monkeypatch.setattr('app.repositories.experiments.list_for_profile', lambda *_: [{'is_seeded': False, 'metrics': [stored]}])
    assert running_questions('p')[0]['short_label'] == 'Energy'
    assert running_questions('p')[0]['unit'] == '/10'


def test_the_progress_example_carries_labels_units_and_a_name():
    progress_summary._example.cache_clear()
    example = progress_summary._example()
    first = next(m for m in example.metrics if m.key == 'morning_energy')
    assert first.short_label == 'Morning energy'
    assert first.unit == '/10'
    assert first.runs[0].short_name


def test_a_finished_experiment_in_progress_carries_its_label_unit_and_name():
    row = {
        'id': 'e1', 'question': 'Does a walk help?', 'completed_at': None,
        'intervention': {'action': 'Walk for 20 minutes after dinner', 'timing': 'Evening', 'frequency': 'Daily'},
        'metrics': [{**SCALE, 'key': 'morning_energy', 'label': 'How energetic do you feel?'}],
    }
    analysis = {'metrics': [{'key': 'morning_energy', 'label': 'How energetic do you feel?', 'type': 'scale', 'baseline': {'mean': 5}, 'intervention': {'mean': 6}, 'percent_change': 20}]}
    trend = progress_summary._trends([(row, analysis)])[0]
    assert (trend.short_label, trend.unit) == ('Morning energy', '/10')
    assert trend.runs[0].short_name == 'Walk for 20 minutes'


def test_a_kept_habit_carries_a_short_name():
    kept = progress_summary._kept({
        'id': 'e1', 'question': 'q', 'completed_at': None,
        'intervention': {'action': 'Walk 5 km at a comfortable steady pace.', 'timing': 'Evening', 'frequency': 'Daily'},
    })
    assert kept.short_name == 'Walk 5 km'
    assert kept.habit.startswith('Walk 5 km at')


def test_the_sample_has_short_labels_with_no_field_stored():
    saved = [Metric.model_validate(raw) for raw in seed.COMPLETED_EXPERIMENT['metrics']]
    assert [m.short_label for m in saved] == ['Morning energy', 'Sleep quality']
