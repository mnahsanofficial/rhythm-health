"""The shapes of what Supabase and OpenRouter send back, as plain dicts with named keys.

TypedDicts add types and change nothing at runtime. `total=False` because a query can select
fewer columns, and because older rows may lack a column added by a later migration.
"""
from typing import Any, TypedDict


class ExperimentRow(TypedDict, total=False):
    id: str
    profile_id: str
    status: str
    question: str
    category: str
    hypothesis: str
    intervention: dict[str, Any]
    baseline_days: int
    intervention_days: int
    metrics: list[dict[str, Any]]
    success_criteria: dict[str, Any]
    prediction: dict[str, Any]
    personal_guess_percent: float | None
    started_at: str | None
    completed_at: str | None
    is_seeded: bool
    created_at: str
    updated_at: str


class CheckinRow(TypedDict, total=False):
    id: str
    experiment_id: str
    day_number: int
    phase: str
    metric_values: dict[str, bool | int | float]
    intervention_completed: bool | None
    note: str | None
    created_at: str


class DecisionAnswer(TypedDict, total=False):
    """One answer from OpenRouter's Decisions API, for example {"type": "choice", "choice": "sleep"}."""

    type: str
    choice: str


class DecisionQuestion(TypedDict):
    type: str
    instructions: str
    criteria: dict[str, str]
