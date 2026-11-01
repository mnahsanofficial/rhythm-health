from app.schemas.analysis import Analysis
from app.schemas.experiment import ExperimentOut, Metric
from app.schemas.lab_report import (
    ChartData,
    ChartMetric,
    ChartPoint,
    LabReport,
    PredictedBand,
    ReportNarrative,
)
from app.services.progress import with_progress


def narrative_to_columns(narrative: ReportNarrative) -> dict:
    """Map the narrative onto the existing experiment_reports columns."""
    return {
        "interpretation": {
            "summary": narrative.summary,
            "interpretation": narrative.interpretation,
            "confounders": narrative.confounders,
        },
        "learnings": narrative.personal_learnings,
        "next_experiment": narrative.next_experiment.model_dump(),
    }


def narrative_from_row(report_row: dict) -> ReportNarrative | None:
    stored = report_row.get("interpretation")
    if not stored:
        return None
    return ReportNarrative.model_validate(
        {
            **stored,
            "personal_learnings": report_row.get("learnings"),
            "next_experiment": report_row.get("next_experiment"),
        }
    )


def build_lab_report(experiment_row: dict, report_row: dict, checkins: list[dict]) -> LabReport:
    analysis = Analysis.model_validate(report_row["analysis"])
    return LabReport(
        experiment=ExperimentOut.model_validate(with_progress(experiment_row)),
        analysis=analysis,
        narrative=narrative_from_row(report_row),
        chart=build_chart(experiment_row, checkins, analysis),
        created_at=report_row["created_at"],
    )


def build_chart(experiment_row: dict, checkins: list[dict], analysis: Analysis) -> ChartData:
    """Chart-ready data (TRD 26). Values come straight from the check-ins and the stored
    analysis; nothing is recalculated here."""
    metrics = [Metric.model_validate(m) for m in experiment_row["metrics"]]
    chart_metrics = [
        ChartMetric(key=m.key, label=m.label, type=m.type, min=m.min, max=m.max) for m in metrics
    ]
    primary = next(m for m in chart_metrics if m.key == analysis.primary_metric)

    baseline_days = experiment_row["baseline_days"]
    total = baseline_days + experiment_row["intervention_days"]
    by_day = {c["day_number"]: c for c in checkins}

    missed = set(analysis.adherence.missing_days)
    points = []
    for day in range(1, total + 1):
        checkin = by_day.get(day)
        phase = "baseline" if day <= baseline_days else "intervention"
        if checkin is None:
            points.append(ChartPoint(day=day, phase=phase, logged=False, missed=day in missed))
            continue
        values = checkin["metric_values"]
        primary_value = values.get(primary.key)
        points.append(
            ChartPoint(
                day=day,
                phase=checkin["phase"],
                logged=True,
                intervention_completed=checkin["intervention_completed"],
                value=float(primary_value) if primary_value is not None else None,
                values=values,
                note=checkin.get("note"),
            )
        )

    primary_stats = next(m for m in analysis.metrics if m.key == primary.key)
    baseline_mean = primary_stats.baseline.mean
    band = None
    if analysis.prediction is not None and baseline_mean is not None:
        p = analysis.prediction
        values = sorted(
            (baseline_mean * (1 + p.predicted_min / 100), baseline_mean * (1 + p.predicted_max / 100))
        )
        band = PredictedBand(
            min_percent=p.predicted_min,
            max_percent=p.predicted_max,
            midpoint_percent=p.predicted_midpoint,
            expected_value_min=round(values[0], 3),
            expected_value_max=round(values[1], 3),
        )

    return ChartData(
        primary_metric=primary,
        metrics=chart_metrics,
        baseline_days=baseline_days,
        intervention_days=experiment_row["intervention_days"],
        points=points,
        baseline_mean=baseline_mean,
        intervention_mean=primary_stats.intervention.mean,
        predicted_band=band,
    )
