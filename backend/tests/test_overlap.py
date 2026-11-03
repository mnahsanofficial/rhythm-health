"""Overlap between experiments is worked out in Python, from real windows and recorded days."""
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest

from app.integrations import openrouter
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import experiments
from app.schemas.analysis import Analysis
from app.services.analysis import analyze, experiment_overlaps
from app.services.report_writer import SYSTEM, write_narrative
from tests.test_analysis import METRICS, PREDICTION, make_checkins

T0 = datetime(2026, 10, 1, 8, tzinfo=UTC)
ENERGY_BASE, ENERGY_TEST = [5, 5, 5], [6, 6, 6, 6, 6, 6, 6]


def days(n):
    return T0 + timedelta(days=n)


def mine(started=T0, baseline=3, test=7):
    return {
        "id": "mine", "question": "Does walking help?", "started_at": started.isoformat(),
        "baseline_days": baseline, "intervention_days": test, "is_seeded": False,
        "metrics": METRICS, "prediction": PREDICTION,
        "success_criteria": {"primary_metric": "morning_energy", "minimum_change_percent": 10},
    }


def other(started, baseline=3, test=7, completed=None, **extra):
    return {
        "id": "other", "question": "Does less coffee help?", "status": "active",
        "started_at": started.isoformat() if started else None,
        "completed_at": completed.isoformat() if completed else None,
        "baseline_days": baseline, "intervention_days": test, "is_seeded": False, **extra,
    }


def recorded():
    return make_checkins(ENERGY_BASE, ENERGY_TEST)


END = days(10)


def overlaps(*others, checkins=None, experiment=None, until=END):
    return experiment_overlaps(experiment or mine(), recorded() if checkins is None else checkins, list(others), until)


def test_nothing_else_running_means_no_overlap():
    assert overlaps() == []


def test_the_experiment_never_overlaps_itself():
    assert overlaps({**other(T0), "id": "mine"}) == []


def test_proposed_and_seeded_experiments_are_ignored():
    assert overlaps(other(None, status="proposed")) == []
    assert overlaps(other(T0, is_seeded=True)) == []


def test_the_other_ones_normal_days_do_not_count():
    # Its test phase starts exactly when mine ends: only its baseline touches mine.
    assert overlaps(other(days(7), baseline=3)) == []


def test_counts_only_test_phase_days_on_my_test_days():
    # Other starts day 3 (index), test from day 6: my days 7-10 overlap fully.
    [found] = overlaps(other(days(3), baseline=3, test=7))
    assert found.test_days_overlapping == 4
    assert found.baseline_days_overlapping == 0
    assert found.experiment_id == "other"
    assert found.question == "Does less coffee help?"
    assert found.description == (
        'You were also testing "Does less coffee help?" on 4 of your 7 recorded test days, '
        "so part of this change may come from that."
    )


def test_a_change_running_during_my_normal_days_counts_separately():
    # Other's test phase covers my whole run.
    [found] = overlaps(other(days(-4), baseline=3, test=20))
    assert found.baseline_days_overlapping == 3
    assert found.test_days_overlapping == 7
    assert "7 of your 7 recorded test days and 3 of your 3 recorded normal days" in found.description


def test_normal_days_only_is_still_said_plainly():
    # Other's test phase ends on my day 2.
    [found] = overlaps(other(days(-9), baseline=3, test=8))
    assert found.test_days_overlapping == 0
    assert found.baseline_days_overlapping == 2
    assert "2 of your 3 recorded normal days" in found.description
    assert "test days" not in found.description


def test_singular_days_read_properly():
    [found] = overlaps(other(days(6), baseline=3, test=7))
    assert found.test_days_overlapping == 1
    assert "1 of your 7 recorded test days" in found.description


def test_stops_when_the_other_finished_early():
    # Other's test phase starts at my day 4 but it finished at the start of my day 6.
    [found] = overlaps(other(days(0), baseline=3, test=7, completed=days(5)))
    assert found.test_days_overlapping == 2


def test_stops_at_the_other_ones_planned_end_if_it_is_still_open():
    # Planned end is day 5 of mine, even though it was never finished.
    [found] = overlaps(other(days(-3), baseline=3, test=5))
    assert found.test_days_overlapping == 2
    assert found.baseline_days_overlapping == 3


def test_still_running_when_i_finish_early_only_counts_up_to_my_finish():
    # I finish at the start of my day 6; other keeps running afterwards.
    logged = make_checkins(ENERGY_BASE, [6, 6])
    [found] = overlaps(other(days(0), baseline=3, test=7), checkins=logged, until=days(5))
    assert found.test_days_overlapping == 2


def test_an_experiment_that_started_after_i_finished_is_ignored():
    assert overlaps(other(days(11))) == []


def test_part_of_a_day_counts_as_overlap():
    # Other's test phase ends one hour into my day 4.
    start = days(3) + timedelta(hours=1) - timedelta(days=10)
    [found] = overlaps(other(start, baseline=3, test=7))
    assert found.test_days_overlapping == 1


def test_a_window_that_only_touches_at_the_boundary_is_not_overlap():
    # Other's test phase ends at the exact moment my day 4 begins.
    start = days(3) - timedelta(days=10)
    [found] = overlaps(other(start, baseline=3, test=7))
    assert found.test_days_overlapping == 0
    assert found.baseline_days_overlapping == 3


def test_missed_days_are_not_counted():
    logged = [c for c in recorded() if c["day_number"] not in {8, 9}]
    [found] = overlaps(other(days(3), baseline=3, test=7), checkins=logged)
    assert found.test_days_overlapping == 2
    assert "2 of your 5 recorded test days" in found.description


def test_several_others_are_listed_oldest_first():
    newer = {**other(days(2), baseline=1, test=9), "id": "newer", "question": "Newer?"}
    older = {**other(days(1), baseline=1, test=9), "id": "older", "question": "Older?"}
    assert [o.experiment_id for o in overlaps(newer, older)] == ["older", "newer"]


def test_analyze_stores_overlap_and_leaves_the_verdict_alone():
    alone = analyze(mine(), recorded(), END)
    together = analyze(mine(), recorded(), END, others=[other(days(3))])
    assert alone.overlaps == []
    assert together.overlaps[0].test_days_overlapping == 4
    assert together.signal == alone.signal
    assert together.metrics == alone.metrics


def test_reports_stored_before_this_feature_still_parse():
    stored = analyze(mine(), recorded(), END).model_dump(mode="json")
    del stored["overlaps"]
    assert Analysis.model_validate(stored).overlaps == []


def test_the_report_writer_gets_the_overlap_and_a_rule_against_inventing_it(monkeypatch):
    complete = Mock(side_effect=AssertionError("stop before the AI"))
    monkeypatch.setattr(openrouter, "complete", complete)
    result = analyze(mine(), recorded(), END, others=[other(days(3))])
    experiment = {**mine(), "hypothesis": "h", "intervention": {"action": "walk"}}
    with pytest.raises(AssertionError, match="stop before"):
        write_narrative(experiment, result, recorded(), {})
    prompt = complete.call_args.kwargs["user"]
    assert "Does less coffee help?" in prompt and '"test_days_overlapping":4' in prompt
    assert "overlaps" in SYSTEM


# --- through the endpoint ------------------------------------------------------------


@pytest.fixture
def completion(monkeypatch):
    from tests import test_completion as module
    fake = module.FakeDb()
    for target, name, value in [
        (module.profiles, "get_by_user_id", fake.get_profile),
        (experiments, "get", fake.get_experiment),
        (experiments, "complete", fake.complete),
        (module.checkins, "list_for_experiment", fake.list_checkins),
        (module.reports, "upsert", fake.upsert_report),
    ]:
        monkeypatch.setattr(target, name, value)
    module.app.dependency_overrides[module.get_current_user] = lambda: fake.current
    yield fake, module
    module.app.dependency_overrides.clear()


def test_completing_saves_overlap_from_this_persons_other_experiments(completion, monkeypatch):
    fake, module = completion
    started = datetime.fromisoformat(fake.experiment["started_at"])
    read = Mock(return_value=[other(started - timedelta(days=4), baseline=3, test=30)])
    monkeypatch.setattr(experiments, "list_for_profile", read)
    response = module.client.post(module.COMPLETE)
    assert response.status_code == 200
    read.assert_called_once_with(f"profile-of-{module.ALICE}")
    assert response.json()["analysis"]["overlaps"][0]["question"] == "Does less coffee help?"
    assert fake.reports[module.EXP_ID]["analysis"]["overlaps"][0]["question"] == "Does less coffee help?"


def test_completing_fails_rather_than_silently_losing_the_overlap(completion, monkeypatch):
    fake, module = completion
    monkeypatch.setattr(experiments, "list_for_profile", Mock(side_effect=SupabaseUnavailable("down")))
    assert module.client.post(module.COMPLETE).status_code == 503
    assert fake.experiment["status"] == "active"
    assert fake.reports == {}


def test_completing_a_sample_never_reads_real_experiments(completion, monkeypatch):
    fake, module = completion
    fake.experiment["is_seeded"] = True
    read = Mock(side_effect=AssertionError("A sample must not read real experiments"))
    monkeypatch.setattr(experiments, "list_for_profile", read)
    response = module.client.post(module.COMPLETE)
    assert response.status_code == 200
    assert response.json()["analysis"]["overlaps"] == []
