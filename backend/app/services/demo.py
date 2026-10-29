from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from app.demo import seed
from app.repositories import checkins, experiments, reports
from app.schemas.lab_report import LabReport
from app.services import analysis
from app.services.lab_report import build_lab_report, narrative_to_columns


def demo_experiment_id(profile_id: str) -> str:
    """The same id on every reset, so a bookmarked demo report keeps working."""
    return str(uuid5(NAMESPACE_URL, f"rhythm-health-demo/{profile_id}"))


def reset(profile_id: str, now: datetime | None = None) -> LabReport:
    """Replace this profile's seeded demo with a fresh completed experiment and report.

    Only rows marked `is_seeded` are removed, so normal experiments (including an active
    one) are untouched. The experiment, check-ins and report are written through the same
    tables as a real run, and the analysis is computed, not stored text.
    """
    now = now or datetime.now(UTC)
    started_at, completed_at = seed.timeline(now)
    experiment_id = demo_experiment_id(profile_id)

    experiments.delete_seeded(profile_id)
    row = experiments.create(
        profile_id,
        {
            **seed.EXPERIMENT,
            "id": experiment_id,
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
        },
    )
    logged = checkins.create_many(experiment_id, seed.checkins())

    result = analysis.analyze(row, logged, completed_at)
    reports.upsert(experiment_id, result.model_dump(mode="json"))
    saved = reports.save_narrative(experiment_id, narrative_to_columns(seed.narrative()))
    return build_lab_report(row, saved, logged)
