from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

AgeRange = Literal["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
ActivityLevel = Literal[
    "sedentary", "lightly_active", "moderately_active", "very_active"
]

ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
TextList = Annotated[list[ShortText], Field(max_length=20)]


class SleepSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bedtime: ClockTime
    wake_time: ClockTime


class ProfileIn(BaseModel):
    """PUT body. No user_id: the user comes from the verified token."""

    model_config = ConfigDict(extra="forbid")

    age_range: AgeRange
    usual_sleep_hours: float = Field(ge=3, le=14)
    usual_sleep_schedule: SleepSchedule
    activity_level: ActivityLevel
    goals: TextList
    regular_habits: TextList
    constraints: TextList


class ProfileOut(ProfileIn):
    # Database rows carry user_id; ignore it so it is never returned to the client.
    model_config = ConfigDict(extra="ignore")

    id: UUID
    created_at: datetime
    updated_at: datetime
