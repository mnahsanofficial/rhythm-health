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
