from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class Prediction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_metric: str
    direction: Literal["increase", "decrease", "no_change"]
    # Percent change in the target metric, as a range (never false precision).
    expected_change_min: float = Field(ge=-100, le=200)
    expected_change_max: float = Field(ge=-100, le=200)
    confidence: Literal["low", "moderate", "high"]
    reasoning: Text
    uncertainty_factors: Annotated[list[Text], Field(min_length=1, max_length=8)]

    @model_validator(mode="after")
    def _ordered_range(self) -> Self:
        if self.expected_change_min > self.expected_change_max:
            raise ValueError("expected_change_min must be <= expected_change_max")
        return self
