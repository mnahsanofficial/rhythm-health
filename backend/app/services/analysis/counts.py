from app.services.analysis.thresholds import MIN_BASELINE_CHECKINS, MIN_INTERVENTION_CHECKINS


def required_checkins(baseline_days: int, intervention_days: int) -> tuple[int, int]:
    return (
        min(MIN_BASELINE_CHECKINS, baseline_days),
        min(MIN_INTERVENTION_CHECKINS, intervention_days),
    )


def checkin_counts(checkins: list[dict]) -> tuple[int, int]:
    baseline = sum(1 for c in checkins if c["phase"] == "baseline")
    return baseline, len(checkins) - baseline
