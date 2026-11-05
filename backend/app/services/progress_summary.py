"""Compares finished experiments, metric by metric. No AI call, and nothing stored here.

Keys are compared exactly: the designer reuses a key only when a metric measures the same thing, so two
different keys are never treated as one measure, even with the same label.
"""
from datetime import UTC, datetime
from functools import lru_cache

from app.demo import seed
from app.repositories import experiments, reports
from app.schemas.experiment import Intervention, Metric
from app.schemas.progress_summary import KeptHabit, MetricRun, MetricTrend, ProgressExample, ProgressSummary
from app.schemas.short_labels import short_label_for
from app.services import analysis as analysis_service

MAX_EXPERIMENTS = 20
EXAMPLE_ID = "example"


def load(profile_id: str) -> ProgressSummary:
    """Raises SupabaseUnavailable if the database can't be reached."""
    rows = experiments.list_completed(profile_id, MAX_EXPERIMENTS)  # Sample experiments are left out.
    analyses = {
        report["experiment_id"]: report["analysis"]
        for report in reports.list_for_experiments([row["id"] for row in rows])
    }
    finished = [(row, analyses[row["id"]]) for row in reversed(rows) if row["id"] in analyses]  # Newest first as read.
    metrics = _trends(finished)
    return ProgressSummary(
        metrics=metrics,
        kept=[_kept(row) for row in rows if row.get("outcome") == "keep"],
        example=None if metrics else _example(),
    )


def _trends(finished: list[tuple[dict, dict]]) -> list[MetricTrend]:
    """Oldest experiment first. A report in an older shape has no `metrics`, and is left out."""
    grouped: dict[tuple[str, str], list[tuple[dict, MetricRun]]] = {}
    shorts: dict[tuple[str, str], tuple[str, str | None]] = {}
    for row, analysis in finished:
        for metric in analysis.get("metrics") or []:
            run = MetricRun(
                experiment_id=row["id"],
                question=row["question"],
                short_name=_short_name(row),
                completed_at=row.get("completed_at"),
                baseline_mean=(metric.get("baseline") or {}).get("mean"),
                result_mean=(metric.get("intervention") or {}).get("mean"),
                percent_change=metric.get("percent_change"),
            )
            grouped.setdefault((metric["key"], metric["type"]), []).append((metric, run))
            shorts[(metric["key"], metric["type"])] = _short_words(row, metric)  # The newest wording.
    trends = [
        MetricTrend(
            key=key,
            label=items[-1][0]["label"],  # The newest wording.
            short_label=shorts[(key, kind)][0],
            unit=shorts[(key, kind)][1],
            type=kind,
            runs=[run for _, run in items],
            normal_change=_normal_change([run for _, run in items]),
        )
        for (key, kind), items in grouped.items()
    ]
    return sorted(trends, key=lambda trend: (-len(trend.runs), trend.label))


def _normal_change(runs: list[MetricRun]) -> float | None:
    if len(runs) < 2 or runs[0].baseline_mean is None or runs[-1].baseline_mean is None:
        return None
    return round(runs[-1].baseline_mean - runs[0].baseline_mean, 2)


def _short_words(row: dict, metric: dict) -> tuple[str, str | None]:
    """A report only keeps a metric's key and label, so its short words come from the experiment's own metric."""
    for raw in row.get("metrics") or []:
        if raw["key"] == metric["key"]:
            saved = Metric.model_validate(raw)
            return saved.short_label, saved.unit
    return short_label_for(metric["key"], metric["label"]), None


def _short_name(row: dict) -> str:
    return Intervention.model_validate(row["intervention"]).short_name


def _kept(row: dict) -> KeptHabit:
    return KeptHabit(
        experiment_id=row["id"],
        question=row["question"],
        habit=row["intervention"]["action"],
        short_name=_short_name(row),
        completed_at=row.get("completed_at"),
    )


@lru_cache(maxsize=1)
def _example() -> ProgressExample:
    """The completed demo sample, computed the same way as real results. Reads and writes nothing."""
    started_at, completed_at = seed.timeline(datetime.now(UTC))
    row = {**seed.COMPLETED_EXPERIMENT, "started_at": started_at.isoformat(), "completed_at": completed_at.isoformat()}
    analysis = analysis_service.analyze(row, seed.checkins(), completed_at).model_dump()
    labelled = {**row, "id": EXAMPLE_ID, "question": seed.QUESTION, "completed_at": None}
    return ProgressExample(question=seed.QUESTION, metrics=_trends([(labelled, analysis)]))
