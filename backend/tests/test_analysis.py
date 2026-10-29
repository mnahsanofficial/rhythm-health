import json

import pytest

from app.services import analysis
from app.services.analysis import analyze, prediction_accuracy

# The seeded shape from the TRD: 3 baseline + 7 intervention days, primary metric
# morning_energy, predicted +8 to +15%, success threshold 10%.
METRICS = [
    {"key": "morning_energy", "label": "Morning energy", "type": "scale", "min": 1, "max": 10, "primary": True},
    {"key": "sleep_quality", "label": "Sleep quality", "type": "scale", "min": 1, "max": 10, "primary": False},
    {"key": "walked", "label": "Walked", "type": "boolean", "min": None, "max": None, "primary": False},
]
PREDICTION = {
    "target_metric": "morning_energy",
    "direction": "increase",
    "expected_change_min": 8,
    "expected_change_max": 15,
    "confidence": "moderate",
    "reasoning": "r",
    "uncertainty_factors": ["u"],
}


def experiment(baseline_days=3, intervention_days=7, prediction=None, threshold=10):
    return {
        "metrics": METRICS,
        "success_criteria": {"primary_metric": "morning_energy", "minimum_change_percent": threshold},
        "prediction": prediction or PREDICTION,
        "baseline_days": baseline_days,
        "intervention_days": intervention_days,
    }


def make_checkins(baseline, intervention, completed=None, sleep=None, start_day=1):
    """energy lists per phase; `completed` flags per intervention day (default all True)."""
    rows = []
    day = start_day
    for energy in baseline:
        rows.append(row(day, "baseline", energy, False, sleep))
        day += 1
    flags = completed if completed is not None else [True] * len(intervention)
    for energy, done in zip(intervention, flags, strict=True):
        rows.append(row(day, "intervention", energy, done, sleep))
        day += 1
    return rows


def row(day, phase, energy, done, sleep=None):
    return {
        "day_number": day,
        "phase": phase,
        "intervention_completed": done,
        "metric_values": {"morning_energy": energy, "sleep_quality": sleep or 6, "walked": done},
    }


# Realistic seeded data: energy rises about 11%, consistently, with one skipped walk.
SEEDED = make_checkins(
    baseline=[5, 6, 6],
    intervention=[6, 6, 7, 6, 6, 7, 6],
    completed=[True, True, True, False, True, True, True],
)


def primary(a):
    return next(m for m in a.metrics if m.primary)


def test_seeded_experiment_is_a_likely_signal_close_to_prediction():
    a = analyze(experiment(), SEEDED)
    p = primary(a)
    assert p.baseline.n == 3 and p.intervention.n == 7
    assert p.baseline.mean == pytest.approx(5.667, abs=1e-3)
    assert p.intervention.mean == pytest.approx(6.286, abs=1e-3)
    assert p.absolute_change == pytest.approx(0.619, abs=1e-3)
    assert p.percent_change == pytest.approx(10.92, abs=0.01)
    assert p.direction_consistency == pytest.approx(1.0)  # all 7 above the baseline mean
    assert p.effect_size > 0.8
    assert a.signal.classification == "likely_signal"
    assert a.signal.success_criteria_met and a.signal.matches_predicted_direction
    assert a.prediction.within_predicted_range
    assert a.prediction.direction_correct
    assert a.prediction.accuracy_percent > 90
    json.dumps(a.model_dump(mode="json"))  # storable as JSON


def test_adherence_counts_and_missing_days():
    checkins = [c for c in SEEDED if c["day_number"] not in (2, 9)]
    a = analyze(experiment(), checkins).adherence
    assert a.baseline_days_logged == 2
    assert a.intervention_days_logged == 6
    assert a.intervention_days_completed == 5  # day 7 was the skipped walk
    assert a.adherence_rate == pytest.approx(5 / 6, abs=1e-3)
    assert a.coverage_rate == 0.8
    assert a.missing_days == [2, 9]


def test_boolean_metric_is_analyzed_as_a_rate():
    walked = next(m for m in analyze(experiment(), SEEDED).metrics if m.key == "walked")
    assert walked.baseline.mean == 0.0
    assert walked.intervention.mean == pytest.approx(6 / 7, abs=1e-3)
    assert walked.percent_change is None  # baseline mean 0: relative change undefined


def test_fewer_intervention_days_caps_at_possible_signal():
    few = make_checkins([5, 6, 6], [6, 7, 6])
    a = analyze(experiment(intervention_days=3), few)
    assert a.signal.classification == "possible_signal"
    assert "few_intervention_days" in a.signal.reasons


def test_low_adherence_demotes_a_strong_result():
    a = analyze(
        experiment(),
        make_checkins([5, 6, 6], [6, 6, 7, 6, 6, 7, 6], completed=[True, False, False, False, True, False, False]),
    )
    assert a.signal.classification == "possible_signal"
    assert "low_adherence" in a.signal.reasons


def test_no_change_is_probably_noise():
    a = analyze(experiment(), make_checkins([5, 7, 6], [6, 5, 7, 6, 5, 7, 6]))
    assert primary(a).percent_change == 0
    assert a.signal.classification == "probably_noise"
    assert not a.signal.success_criteria_met


def test_tiny_noisy_gain_is_probably_noise():
    a = analyze(experiment(), make_checkins([5, 7, 6], [7, 5, 6, 7, 5, 7, 6.5]))
    assert a.signal.classification == "probably_noise"


def test_mixed_result_is_unclear():
    # +12% on average but only half the days beat the baseline: neither signal nor noise
    a = analyze(experiment(), make_checkins([5, 6, 5], [8, 4, 8, 4, 8, 4, 9, 4]))
    p = primary(a)
    assert p.percent_change > 10
    assert p.direction_consistency == 0.5
    assert a.signal.classification == "unclear"


def test_strong_move_against_the_prediction_is_unclear_not_a_signal():
    a = analyze(experiment(), make_checkins([7, 7, 8], [5, 5, 6, 5, 5, 6, 5]))
    assert primary(a).percent_change < -10
    assert a.signal.classification == "unclear"
    assert "moved_opposite_to_prediction" in a.signal.reasons
    assert not a.signal.matches_predicted_direction
    assert not a.prediction.direction_correct
    assert a.prediction.accuracy_percent == 0


def test_decrease_prediction_uses_the_decrease_direction():
    pred = {**PREDICTION, "direction": "decrease", "expected_change_min": -15, "expected_change_max": -8}
    a = analyze(experiment(prediction=pred), make_checkins([7, 7, 8], [6, 6, 6, 6, 6, 6, 6]))
    assert primary(a).percent_change < -10
    assert a.signal.classification == "likely_signal"
    assert a.signal.success_criteria_met
    assert a.prediction.direction_correct


def test_no_change_prediction():
    pred = {**PREDICTION, "direction": "no_change", "expected_change_min": -4, "expected_change_max": 4}
    a = analyze(experiment(prediction=pred), make_checkins([6, 6, 6], [6, 6, 6, 6, 6, 6, 6]))
    assert a.prediction.direction_correct and a.prediction.within_predicted_range
    assert a.signal.matches_predicted_direction
    assert a.signal.classification == "probably_noise"


def test_zero_variability_with_a_change_counts_as_clear():
    a = analyze(experiment(), make_checkins([5, 5, 5], [6, 6, 6, 6, 6, 6, 6]))
    p = primary(a)
    assert p.pooled_sd == 0 and p.effect_size is None
    assert p.percent_change == 20
    assert a.signal.classification == "likely_signal"


def test_outlier_is_flagged():
    a = analyze(experiment(), make_checkins([8, 8, 8], [8, 9, 8, 9, 8, 9, 1]))
    outliers = primary(a).outliers
    assert [(o.phase, o.day_number, o.value) for o in outliers] == [("intervention", 10, 1.0)]


def test_median_change_reported_alongside_mean():
    a = primary(analyze(experiment(), make_checkins([5, 6, 6], [6, 6, 6, 6, 6, 6, 9])))
    assert a.median_change_percent == 0
    assert a.percent_change > 0  # the mean is pulled up by one high day


def test_short_demo_shape_one_baseline_day():
    a = analyze(experiment(baseline_days=1, intervention_days=2), make_checkins([5], [6, 6]))
    p = primary(a)
    assert p.percent_change == 20
    assert p.effect_size is None  # one baseline day: no variability estimate
    assert a.signal.classification in ("possible_signal", "unclear")


def test_requirements_respect_short_experiments():
    assert analysis.required_checkins(3, 7) == (2, 3)
    assert analysis.required_checkins(1, 2) == (1, 2)


# --- prediction accuracy formula --------------------------------------------


@pytest.mark.parametrize(
    "low,high,observed,expected",
    [
        (8, 15, 11.5, 100.0),  # on the midpoint
        (8, 15, 11, 95.7),  # half a point off
        (8, 15, 0, 0.0),  # predicted +11.5, saw nothing
        (8, 15, -20, 0.0),  # wrong way: floored at 0
        (8, 15, 23, 0.0),  # as far above as the midpoint
        (8, 15, 17, 52.2),
        (0, 4, 2, 100.0),  # tiny prediction: scale floor of 10
        (0, 4, 7, 50.0),
    ],
)
def test_prediction_accuracy(low, high, observed, expected):
    assert prediction_accuracy(low, high, observed) == pytest.approx(expected, abs=0.1)


def test_accuracy_is_always_bounded():
    for observed in (-500, -50, 0, 12, 40, 900):
        assert 0 <= prediction_accuracy(8, 15, observed) <= 100
