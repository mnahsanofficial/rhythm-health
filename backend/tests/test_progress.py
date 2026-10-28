from datetime import UTC, datetime, timedelta

import pytest

from app.services.progress import compute_progress

START = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)


def at(delta: timedelta, baseline=3, intervention=7, status="active"):
    return compute_progress(
        status=status,
        started_at=START,
        baseline_days=baseline,
        intervention_days=intervention,
        now=START + delta,
    )


@pytest.mark.parametrize(
    "delta,day,phase,phase_day",
    [
        (timedelta(0), 1, "baseline", 1),
        (timedelta(hours=23, minutes=59), 1, "baseline", 1),
        (timedelta(hours=24), 2, "baseline", 2),
        (timedelta(days=2, hours=23), 3, "baseline", 3),
        (timedelta(days=3), 4, "intervention", 1),
        (timedelta(days=9, hours=23), 10, "intervention", 7),
    ],
)
def test_day_and_phase_boundaries(delta, day, phase, phase_day):
    p = at(delta)
    assert p.state == "in_progress"
    assert (p.day_number, p.phase, p.phase_day) == (day, phase, phase_day)
    assert p.total_days == 10
    assert p.days_remaining == 10 - day


def test_phase_lengths():
    assert at(timedelta(0)).phase_days == 3
    assert at(timedelta(days=3)).phase_days == 7


def test_ends_after_total_days():
    p = at(timedelta(days=10))
    assert p.state == "ended"
    assert p.day_number is None and p.phase is None
    assert p.days_remaining == 0
    assert p.ends_at == START + timedelta(days=10)
    assert at(timedelta(days=30)).state == "ended"


def test_uses_configured_durations():
    # the short demo shape from the TRD: 1 baseline day, 2 intervention days
    assert at(timedelta(hours=1), baseline=1, intervention=2).phase == "baseline"
    p = at(timedelta(days=1), baseline=1, intervention=2)
    assert (p.phase, p.phase_day, p.phase_days, p.total_days) == ("intervention", 1, 2, 3)
    assert at(timedelta(days=3), baseline=1, intervention=2).state == "ended"


def test_clock_slightly_before_start_counts_as_day_one():
    p = at(-timedelta(seconds=5))
    assert (p.state, p.day_number, p.phase) == ("in_progress", 1, "baseline")


@pytest.mark.parametrize("status", ["draft", "proposed"])
def test_not_started_states(status):
    p = compute_progress(
        status=status, started_at=None, baseline_days=3, intervention_days=7, now=START
    )
    assert p.state == "not_started"
    assert p.day_number is None and p.phase is None and p.total_days == 10


def test_completed_experiment():
    p = at(timedelta(days=2), status="completed")
    assert p.state == "completed"
    assert p.day_number is None
