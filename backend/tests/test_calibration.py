"""How close a person's own guesses were to what happened. Computed here, with no AI call."""
import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.demo import seed
from app.integrations import openrouter
from app.integrations.supabase import SupabaseUnavailable
from app.main import app
from app.repositories import experiments, profiles, reports
from app.services import calibration
from tests.test_propose import PROFILE_ROW, USER_ID

client = TestClient(app)
URL = "/api/experiments/calibration"


def finished(number, guess, observed):
    """A completed experiment and its report. Pass guess=None for one made without a guess."""
    row = {"id": f"exp-{number}", "question": f"Question {number}?", "completed_at": f"2026-10-{number:02d}T10:00:00+00:00"}
    personal = None if guess is None else {"guessed_change_percent": guess, "observed_change_percent": observed, "error_points": None}
    return row, {"experiment_id": row["id"], "analysis": {"personal_guess": personal}}


@pytest.fixture
def stored(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    monkeypatch.setattr(profiles, "get_by_user_id", lambda _uid: PROFILE_ROW)
    paid = lambda **_kw: pytest.fail("Calibration must never call a model")  # noqa: E731
    monkeypatch.setattr(openrouter, "complete", paid)
    monkeypatch.setattr(openrouter, "decide", paid)
    state = {"limit": None, "profile": None}

    def install(*items):
        # Newest first, as the repository returns them.
        rows = [row for row, _ in sorted(items, key=lambda item: item[0]["completed_at"], reverse=True)]
        report_rows = [report for _, report in items]

        def list_completed(profile_id, limit):
            state.update(limit=limit, profile=profile_id)
            return rows

        monkeypatch.setattr(experiments, "list_completed", list_completed)
        monkeypatch.setattr(reports, "list_for_experiments", lambda ids: [r for r in report_rows if r["experiment_id"] in ids])

    install()
    yield install, state
    app.dependency_overrides.clear()


def get():
    response = client.get(URL)
    assert response.status_code == 200
    return response.json()


def test_nothing_finished_means_no_real_points_and_no_trend(stored):
    body = get()
    assert (body["points"], body["average_off_by_points"], body["trend"]) == ([], None, None)


def test_experiments_without_a_guess_are_left_out(stored):
    install, _ = stored
    install(finished(1, None, 10), finished(2, 10, None))
    assert get()["points"] == []


def test_one_guess_has_a_gap_but_no_trend_yet(stored):
    install, _ = stored
    install(finished(1, 10, 14))
    body = get()
    assert body["points"] == [{
        "experiment_id": "exp-1",
        "question": "Question 1?",
        "completed_at": "2026-10-01T10:00:00+00:00",
        "guessed_change_percent": 10,
        "observed_change_percent": 14,
        "off_by_points": 4,
    }]
    assert body["average_off_by_points"] == 4
    assert body["trend"] is None


def test_points_run_oldest_first(stored):
    install, _ = stored
    install(finished(2, 5, 5), finished(1, 10, 14))
    assert [point["experiment_id"] for point in get()["points"]] == ["exp-1", "exp-2"]


@pytest.mark.parametrize("items,trend", [
    ([(10, 30), (10, 12)], "closer"),
    ([(10, 12), (10, 30)], "further"),
    ([(10, 15), (10, 14)], "steady"),
    ([(10, 15), (10, 13)], "steady"),  # A change of exactly 2 points is too small to call.
    ([(10, 40), (10, 25), (10, 12), (10, 11)], "closer"),
    ([(10, 40), (10, 99), (10, 12)], "closer"),  # With three, the middle one isn't compared.
])
def test_the_trend_compares_earlier_guesses_with_later_ones(stored, items, trend):
    install, _ = stored
    install(*(finished(index + 1, guess, observed) for index, (guess, observed) in enumerate(items)))
    assert get()["trend"] == trend


def test_the_gap_ignores_direction_and_the_average_is_rounded(stored):
    install, _ = stored
    install(finished(1, 10, 5), finished(2, -10, 0), finished(3, 1.5, 1.25))
    body = get()
    assert [point["off_by_points"] for point in body["points"]] == [5, 10, 0.2]
    assert body["average_off_by_points"] == 5.1


def test_a_report_in_an_older_shape_is_skipped(stored):
    install, _ = stored
    row, _ = finished(1, 10, 14)
    good = finished(2, 10, 12)
    install((row, {"experiment_id": row["id"], "analysis": {"personal_guess": {"unexpected": True}}}), good)
    assert [point["experiment_id"] for point in get()["points"]] == ["exp-2"]


def test_it_only_reads_this_persons_experiments(stored):
    _, state = stored
    get()
    assert state["profile"] == PROFILE_ROW["id"]
    assert state["limit"] == calibration.MAX_EXPERIMENTS


def test_the_database_being_down_is_503(stored, monkeypatch):
    def down(*_a):
        raise SupabaseUnavailable("down")
    monkeypatch.setattr(experiments, "list_completed", down)
    assert client.get(URL).status_code == 503


def test_it_needs_a_signed_in_person():
    assert client.get(URL).status_code == 401


def test_with_no_real_guess_the_demo_sample_comes_back_only_as_a_separate_example(stored):
    body = get()
    assert body["points"] == [] and body["average_off_by_points"] is None and body["trend"] is None
    example = body["example"]
    assert example["question"] == seed.QUESTION
    assert example["guessed_change_percent"] == seed.EXAMPLE_GUESS_PERCENT
    # The sample's real computed result, the same number its Lab Report is built from.
    assert example["observed_change_percent"] == 10.9
    assert example["off_by_points"] == 5.9


def test_a_real_guess_replaces_the_example_and_it_is_never_counted(stored):
    install, _ = stored
    install(finished(1, 10, 14))
    body = get()
    assert body["example"] is None
    assert [point["experiment_id"] for point in body["points"]] == ["exp-1"]
    assert body["average_off_by_points"] == 4
    assert body["trend"] is None


def test_the_example_writes_nothing_and_calls_no_ai(stored, monkeypatch):
    def forbidden(*_a, **_k):
        pytest.fail("Showing the example must not write anything")
    monkeypatch.setattr(experiments, "create", forbidden)
    monkeypatch.setattr(reports, "upsert", forbidden)
    assert get()["example"] is not None


def test_real_results_are_read_with_samples_filtered_out(monkeypatch):
    """list_completed asks the database for is_seeded=false, so a sample's guess can't count."""
    seen = {}
    def rest(method, table, **kwargs):
        seen.update(kwargs["params"])
        return []
    monkeypatch.setattr(experiments, "rest_request", rest)
    experiments.list_completed("profile-1", 20)
    assert seen["is_seeded"] == "eq.false"

