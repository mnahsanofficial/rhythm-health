from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Phase = Literal["baseline", "intervention"]
ProgressState = Literal["not_started", "in_progress", "ended", "completed"]


class ExperimentProgress(BaseModel):
    """Where an experiment is right now. Computed on read, never stored."""

    state: ProgressState
    # Set only while in_progress.
    day_number: int | None = None
    phase: Phase | None = None
    phase_day: int | None = None
    phase_days: int | None = None
    total_days: int
    days_remaining: int | None = None
    started_at: datetime | None = None
    # When the last day finishes; set once started.
    ends_at: datetime | None = None


class ExperimentDay(BaseModel):
    day_number: int
    phase: Literal["baseline", "test"]
    state: Literal["recorded", "missed", "current", "future", "not_observed"]


class ExperimentTimeline(BaseModel):
    """Read-only day states shared by web and mobile.

    Remaining includes an unrecorded current day and future days. Unobserved days
    after completion are excluded. next_day_at is null when no next day can open.
    """

    progress: ExperimentProgress
    next_day_at: datetime | None
    recorded_days: int
    missed_days: int
    remaining_days: int
    days: list[ExperimentDay]
