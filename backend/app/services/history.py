import logging

from app.integrations.supabase import SupabaseUnavailable
from app.repositories import experiments, reports
from app.schemas.analysis import Analysis
from app.schemas.history import PastContext, PastExperiment, TrackRecord

logger = logging.getLogger(__name__)

MAX_EXPERIMENTS = 5
# How many recent completed experiments are considered before picking the best few.
CANDIDATES = 20


def load(profile_id: str, category: str) -> PastContext | None:
    """A few of this person's finished experiments, summarised for the forecast.

    Same-category experiments come first, then the rest, newest first. Returns None when
    there is nothing to learn from, or when history can't be read: a proposal does not
    depend on it.
    """
    try:
        rows = [r for r in experiments.list_completed(profile_id, CANDIDATES) if not r.get("is_seeded")]
        report_rows = reports.list_for_experiments([r["id"] for r in rows])
    except SupabaseUnavailable:
        logger.warning("past experiments unavailable, proposing without them")
        return None

    analyses = {r["experiment_id"]: r["analysis"] for r in report_rows}
    ranked = sorted(
        (r for r in rows if r["id"] in analyses),
        key=lambda r: r["category"] != category,  # stable: keeps newest-first within a group
    )[:MAX_EXPERIMENTS]

    items = []
    for row in ranked:
        item = _summarise(row, analyses[row["id"]])
        if item is not None:
            items.append(item)
    if not items:
        return None
    return PastContext(track_record=_track_record(items), experiments=items)


def _summarise(row: dict, raw_analysis: dict) -> PastExperiment | None:
    try:
        analysis = Analysis.model_validate(raw_analysis)
    except ValueError:
        return None  # a report in an older shape is skipped rather than guessed at

    primary = next((m for m in analysis.metrics if m.primary), None)
    if primary is None:
        return None
    pred = row["prediction"]
    comparison = analysis.prediction
    action = row["intervention"]
    return PastExperiment(
        question=row["question"],
        category=row["category"],
        intervention=f"{action['action']} ({action['timing']}, {action['frequency']})",
        primary_metric=primary.label,
        days=f"{row['baseline_days']} baseline + {row['intervention_days']} test",
        completed=(row["completed_at"] or "")[:10],
        predicted_change_min_percent=pred["expected_change_min"],
        predicted_change_max_percent=pred["expected_change_max"],
        predicted_direction=pred["direction"],
        prediction_confidence=pred["confidence"],
        observed_change_percent=primary.percent_change,
        effect_size=primary.effect_size,
        signal=analysis.signal.classification,
        adherence_rate=analysis.adherence.adherence_rate,
        prediction_accuracy_percent=comparison.accuracy_percent if comparison else None,
        direction_correct=comparison.direction_correct if comparison else None,
        within_predicted_range=comparison.within_predicted_range if comparison else None,
    )


def _track_record(items: list[PastExperiment]) -> TrackRecord:
    errors = [
        i.observed_change_percent
        - (i.predicted_change_min_percent + i.predicted_change_max_percent) / 2
        for i in items
        if i.observed_change_percent is not None
    ]
    return TrackRecord(
        experiments=len(items),
        direction_correct=sum(1 for i in items if i.direction_correct),
        within_range=sum(1 for i in items if i.within_predicted_range),
        average_error_points=round(sum(errors) / len(errors), 1) if errors else None,
    )
