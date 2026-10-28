from typing import Literal

from pydantic import BaseModel, ConfigDict

Category = Literal[
    "sleep", "energy", "focus", "exercise", "nutrition", "stress", "routine", "other"
]
Intent = Literal["behavior_change", "goal", "question", "other"]
Risk = Literal["low", "review", "blocked"]


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Category
    intent: Intent
    risk: Risk
