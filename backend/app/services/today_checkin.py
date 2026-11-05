import hashlib
import json
from datetime import UTC, datetime

from fastapi import HTTPException

from app.repositories import checkins, experiments
from app.schemas.checkin import TodayCheckin, TodayCheckinIn, TodayExperiment, TodayQuestion
from app.schemas.experiment import Intervention, Metric
from app.services.checkins import validate_metric_values
from app.services.progress import with_progress


def due_today(profile_id: str, now: datetime | None = None) -> list[dict]:
    """Running experiments with a day open now, oldest first. Samples hold invented answers,
    so real answers never feed one: a sample keeps its own check-in."""
    rows = [with_progress(r, now) for r in experiments.list_for_profile(profile_id, "active") if not r.get("is_seeded")]
    return sorted((r for r in rows if r["progress"].state == "in_progress"), key=lambda r: (r["started_at"], r["id"]))


def _signature(metric: Metric) -> tuple:
    """Two questions are the same measure only if everything a person answers against matches.
    Never the label alone: merging different scales would quietly corrupt both results."""
    return (metric.key, metric.type, metric.min, metric.max, metric.min_label, metric.max_label)


def questions_for(rows: list[dict], values: dict[str, dict] | None = None) -> list[TodayQuestion]:
    """Each distinct question once, shared ones first. `values` holds today's saved answers
    per experiment, for prefilling."""
    groups: dict[tuple, TodayQuestion] = {}
    for row in rows:
        for raw in row["metrics"]:
            metric = Metric.model_validate(raw)
            group = groups.get(_signature(metric))
            if group is None:
                group = TodayQuestion(id=f"{row['id']}:{metric.key}", metric=metric, experiment_ids=[])
                groups[_signature(metric)] = group
            group.experiment_ids.append(row["id"])
            saved = (values or {}).get(row["id"], {}).get(metric.key)
            if group.value is None and saved is not None:
                group.value = saved
    return sorted(groups.values(), key=lambda q: len(q.experiment_ids) == 1)


def _revision(rows: list[dict], questions: list[TodayQuestion]) -> str:
    """Changes when a day rolls over or the set of questions changes, so answers from an old
    form are never saved against a different day. Carries no day for the client to set."""
    shape = [[r["id"], r["progress"].day_number] for r in rows], [q.id for q in questions]
    return hashlib.sha256(json.dumps(shape).encode()).hexdigest()[:16]


def read(profile_id: str, now: datetime | None = None) -> TodayCheckin:
    rows = due_today(profile_id, now)
    recorded = {}
    for row in rows:
        day = row["progress"].day_number
        recorded[row["id"]] = next((c for c in checkins.list_for_experiment(row["id"]) if c["day_number"] == day), None)
    return _today(rows, recorded)


def _short(row: dict) -> Intervention:
    return Intervention.model_validate(row["intervention"])


def _today(rows: list[dict], recorded: dict[str, dict | None]) -> TodayCheckin:
    values = {eid: c["metric_values"] for eid, c in recorded.items() if c}
    questions = questions_for(rows, values)
    return TodayCheckin(
        revision=_revision(rows, questions),
        experiments=[
            TodayExperiment(
                id=row["id"],
                question=row["question"],
                action=row["intervention"]["action"],
                change_short=_short(row).change_short,
                short_name=_short(row).short_name,
                timing=row["intervention"]["timing"],
                day_number=row["progress"].day_number,
                total_days=row["progress"].total_days,
                phase=row["progress"].phase,
                change_required=row["progress"].phase == "intervention",
                change_made=(recorded[row["id"]]["intervention_completed"]
                             if recorded[row["id"]] and row["progress"].phase == "intervention" else None),
                recorded=recorded[row["id"]] is not None,
            )
            for row in rows
        ],
        questions=questions,
        note=next((c["note"] for c in recorded.values() if c and c.get("note")), None),
        all_recorded=bool(rows) and all(recorded.values()),
    )


def save(profile_id: str, body: TodayCheckinIn, now: datetime | None = None) -> TodayCheckin:
    """Validate everything, then write every experiment in one request: all saved or none."""
    now = now or datetime.now(UTC)
    rows = due_today(profile_id, now)
    if not rows:
        raise HTTPException(status_code=409, detail="No experiment has a check-in open today")
    questions = questions_for(rows)
    if body.revision != _revision(rows, questions):
        raise HTTPException(status_code=409, detail={
            "code": "checkin_changed",
            "message": "Today's check-in has changed. Reload it to see the current questions.",
        })

    errors: list[dict[str, str]] = []
    known = {q.id for q in questions}
    errors += [{"field": key, "message": "Not a question in today's check-in"} for key in body.answers if key not in known]
    by_experiment: dict[str, dict] = {row["id"]: {} for row in rows}
    for question in questions:
        if question.id not in body.answers:
            errors.append({"field": question.id, "message": "Required"})
            continue
        key = question.metric.key
        cleaned, problems = validate_metric_values([question.metric], {key: body.answers[question.id]})
        errors += [{"field": question.id, "message": p["message"]} for p in problems]
        for experiment_id in question.experiment_ids:
            if key in cleaned:
                by_experiment[experiment_id][key] = cleaned[key]

    ids = {row["id"] for row in rows}
    errors += [{"field": f"change:{key}", "message": "Not an experiment in today's check-in"} for key in body.changes if key not in ids]
    for row in rows:
        testing = row["progress"].phase == "intervention"
        if testing and row["id"] not in body.changes:
            errors.append({"field": f"change:{row['id']}", "message": "Required on a test day"})
        if not testing and row["id"] in body.changes:
            errors.append({"field": f"change:{row['id']}", "message": "This experiment is on a normal day"})
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    written = [
        {
            "experiment_id": row["id"],
            "day_number": row["progress"].day_number,
            "phase": row["progress"].phase,
            "intervention_completed": body.changes.get(row["id"], False),
            "metric_values": by_experiment[row["id"]],
            "note": body.note or None,
        }
        for row in rows
    ]
    checkins.upsert_many(written)
    # Answered from what was just written: a later read failing must not look like a failed save.
    return _today(rows, {w["experiment_id"]: w for w in written})
