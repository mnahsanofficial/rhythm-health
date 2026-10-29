from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.analysis import Analysis
from app.schemas.experiment import ExperimentOut


class ReportOut(BaseModel):
    """The AI-written parts (interpretation, learnings, next experiment) come later."""

    model_config = ConfigDict(extra="ignore")

    experiment_id: UUID
    analysis: Analysis
    interpretation: dict | None = None
    learnings: dict | list | None = None
    next_experiment: dict | None = None
    created_at: datetime


class CompleteResponse(BaseModel):
    experiment: ExperimentOut
    report: ReportOut
