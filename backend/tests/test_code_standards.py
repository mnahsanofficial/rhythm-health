"""Route logic lives in services, rows have types, and analysis stays in small modules."""
import asyncio
import typing
from pathlib import Path

import pytest

from app.api import deps
from app.integrations import openrouter
from app.repositories import checkins, experiments, reports
from app.schemas.rows import DecisionAnswer, ExperimentRow
from app.services import analysis, completion
from tests.test_completion import EXP_ID, FakeDb, experiment_row

ANALYSIS = Path(analysis.__file__).parent


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(experiments, "complete", fake.complete)
    monkeypatch.setattr(experiments, "list_for_profile", lambda *_a: [])
    monkeypatch.setattr(checkins, "list_for_experiment", fake.list_checkins)
    monkeypatch.setattr(reports, "upsert", fake.upsert_report)
    return fake


@pytest.mark.parametrize("status,message", [
    ("completed", "This experiment is already completed"),
    ("proposed", "Only an active experiment can be completed"),
])
def test_only_an_active_experiment_can_be_completed(status, message):
    with pytest.raises(completion.CompletionConflict) as caught:
        completion.ensure_can_complete({"status": status})
    assert caught.value.detail == message


def test_the_service_saves_the_report_then_completes_the_experiment(db):
    report = asyncio.run(completion.complete_experiment(db.experiment, db.experiment["profile_id"], EXP_ID))
    assert report.experiment.status == "completed"
    assert EXP_ID in db.reports


def test_too_few_checkins_carry_the_counts(db, monkeypatch):
    monkeypatch.setattr(checkins, "list_for_experiment", lambda _id: [])
    with pytest.raises(completion.CompletionConflict) as caught:
        asyncio.run(completion.complete_experiment(experiment_row(), "profile", EXP_ID))
    assert caught.value.detail["message"] == "Not enough check-ins to complete this experiment yet"
    assert caught.value.detail["baseline_checkins"] == 0


def test_the_route_holds_no_analysis_logic():
    source = Path(deps.__file__).with_name("reports.py").read_text()
    assert "analysis.analyze" not in source
    assert "required_checkins" not in source


def test_rows_and_decisions_have_types():
    assert typing.get_type_hints(deps.owned_experiment)["return"] is ExperimentRow
    assert typing.get_type_hints(openrouter.decide)["return"] == dict[str, DecisionAnswer]
    assert "status" in ExperimentRow.__annotations__ and "personal_guess_percent" in ExperimentRow.__annotations__


def test_analysis_keeps_its_public_names_in_small_modules():
    for name in ("analyze", "required_checkins", "checkin_counts", "experiment_overlaps",
                 "baseline_summary", "adherence_for", "prediction_accuracy", "classify_signal"):
        assert callable(getattr(analysis, name))
    sizes = {path.name: len(path.read_text().splitlines()) for path in ANALYSIS.glob("*.py")}
    assert len(sizes) > 1
    assert max(sizes.values()) <= 150, sizes
