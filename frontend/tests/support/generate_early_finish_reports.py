"""Generate synthetic F4 fixtures using the merged backend's actual analysis/report builder.

Run from the repo root with backend/.venv/bin/python. No settings, DB, auth or AI client
is imported. The fake rows stay in memory; this script only writes JSON to stdout.
"""
import json
import sys
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))

from app.demo import seed  # noqa: E402
from app.schemas.experiment import ExperimentOut  # noqa: E402
from app.services.analysis import analyze, required_checkins  # noqa: E402
from app.services.lab_report import build_lab_report  # noqa: E402
from app.services.progress import with_progress
from app.services.timeline import experiment_timeline  # noqa: E402

START = datetime(2026, 10, 26, 5, 30, tzinfo=UTC)
DAY = timedelta(hours=24)


def experiment(name, clock, status="completed"):
    row = {
        **deepcopy(seed.EXPERIMENT),
        "id": str(uuid5(NAMESPACE_URL, f"rhythm-f4-verification/{name}")),
        "is_seeded": False,
        "status": status,
        "started_at": START.isoformat(),
        "completed_at": clock.isoformat() if status == "completed" else None,
        "created_at": START.isoformat(),
        "updated_at": clock.isoformat(),
    }
    return row


def generate():
    # A first-day finish is ineligible (2 baseline + 3 test observations are required).
    # Check its real progress/adherence without inventing an impossible completed report.
    first = experiment("first-day", START, "active")
    first_analysis = analyze(first, [], START)
    assert required_checkins(3, 7) == (2, 3)
    assert first_analysis.adherence.missing_days == []
    assert first_analysis.adherence.coverage_rate == 0
    first_out = ExperimentOut.model_validate(with_progress(first, START)).model_dump(mode="json")
    assert first_out["progress"]["day_number"] == 1

    specs = [
        ("local-date-boundary", datetime(2026, 11, 1, 3, 30, tzinfo=UTC), [1, 3, 4, 5, 6], [2], 5 / 6),
        ("today-unlogged", START + 6.5 * DAY, [1, 3, 4, 5, 6], [2], 5 / 6),
        ("today-logged", START + 6.5 * DAY, [1, 3, 4, 5, 6, 7], [2], 6 / 7),
        # Toronto repeats the 01:00 hour at 06:00 UTC on Nov 1, 2026.
        ("before-toronto-fall-back", datetime(2026, 11, 1, 5, 59, 59, tzinfo=UTC), [1, 3, 4, 5, 6], [2], 5 / 6),
        ("after-toronto-fall-back", datetime(2026, 11, 1, 6, 0, tzinfo=UTC), [1, 3, 4, 5, 6], [2], 5 / 6),
        ("next-24-hour-boundary", START + 7 * DAY, [1, 3, 4, 5, 6], [2, 7], 5 / 7),
        ("last-day-start", START + 9 * DAY, [1, 3, 4, 5, 6, 7, 8, 9], [2], 8 / 9),
        ("last-day-ended", START + 10 * DAY, [1, 3, 4, 5, 6, 7, 8, 9, 10], [2], 9 / 10),
    ]
    cases = []
    for name, clock, logged_days, missed, coverage in specs:
        row = experiment(name, clock)
        logged = [c for c in seed.checkins() if c["day_number"] in logged_days]
        result = analyze(row, logged, clock)
        assert result.adherence.missing_days == missed, name
        assert abs(result.adherence.coverage_rate - coverage) < 0.0006, name
        saved = {
            "analysis": result.model_dump(mode="json"),
            "interpretation": None,
            "learnings": None,
            "next_experiment": None,
            "created_at": clock.isoformat(),
        }
        report = build_lab_report(row, saved, logged).model_dump(mode="json")
        cases.append({
            "name": name,
            "clock": clock.isoformat(),
            "expected": {
                "missing_days": missed,
                "not_reached_days": [d for d in range(1, 11) if d not in logged_days and d not in missed],
                "coverage_rate": round(coverage, 3),
                "logged_days": logged_days,
            },
            "report": report,
            "timeline": experiment_timeline(row, logged, clock).model_dump(mode="json"),
        })
    return {
        "source": "backend/app/services/{analysis,lab_report,timeline}.py; no DB/AI calls",
        "first_day": {"clock": START.isoformat(), "experiment": first_out, "timeline": experiment_timeline(first, [], START).model_dump(mode="json")},
        "cases": cases,
    }


if __name__ == "__main__":
    json.dump(generate(), sys.stdout, indent=2)
    sys.stdout.write("\n")
