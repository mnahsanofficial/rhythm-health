from datetime import datetime

from app.schemas.analysis import ExperimentOverlap
from app.services.analysis.counts import checkin_counts
from app.services.progress import DAY


def experiment_overlaps(
    experiment: dict, checkins: list[dict], others: list[dict], until: datetime | None
) -> list[ExperimentOverlap]:
    """Which other experiments were testing a change during this one's recorded days.

    Only the other's test phase counts: its normal days change nothing. It runs until the
    other finished or its planned end, whichever is first. Only recorded days count, since
    only those feed the analysis, and any part of a day counts as that day. Samples hold
    invented answers, so they never appear.
    """
    started_at = _as_datetime(experiment.get("started_at"))
    if started_at is None or until is None or experiment.get("is_seeded"):
        return []
    baseline_recorded, test_recorded = checkin_counts(checkins)
    found = []
    candidates = (o for o in others if o["id"] != experiment.get("id") and o.get("started_at") and not o.get("is_seeded"))
    for other in sorted(candidates, key=lambda o: _as_datetime(o["started_at"])):
        other_start = _as_datetime(other["started_at"])
        test_start = other_start + other["baseline_days"] * DAY
        test_end = other_start + (other["baseline_days"] + other["intervention_days"]) * DAY
        if other.get("completed_at"):
            test_end = min(test_end, _as_datetime(other["completed_at"]))

        def overlapping(phase: str) -> int:
            count = 0
            for checkin in checkins:
                if checkin["phase"] != phase:
                    continue
                day_start = started_at + (checkin["day_number"] - 1) * DAY
                day_end = min(day_start + DAY, until)
                count += max(day_start, test_start) < min(day_end, test_end)
            return count

        test_days, baseline_days = overlapping("intervention"), overlapping("baseline")
        if not test_days and not baseline_days:
            continue
        spans = []
        if test_days:
            spans.append(f"{test_days} of your {test_recorded} recorded test {'day' if test_recorded == 1 else 'days'}")
        if baseline_days:
            spans.append(f"{baseline_days} of your {baseline_recorded} recorded normal {'day' if baseline_recorded == 1 else 'days'}")
        found.append(ExperimentOverlap(
            experiment_id=other["id"],
            question=other["question"],
            test_days_overlapping=test_days,
            baseline_days_overlapping=baseline_days,
            description=f'You were also testing "{other["question"]}" on {" and ".join(spans)}, so part of this change may come from that.',
        ))
    return found


def _as_datetime(value: datetime | str | None) -> datetime | None:
    return datetime.fromisoformat(value) if isinstance(value, str) else value
