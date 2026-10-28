from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.experiment import ExperimentProposal
from app.schemas.prediction import Prediction


class ProposalWithPrediction(BaseModel):
    """What the model returns in one call. Split into separate objects in our code."""

    model_config = ConfigDict(extra="forbid")

    proposal: ExperimentProposal
    prediction: Prediction

    @model_validator(mode="after")
    def _prediction_targets_primary_metric(self) -> Self:
        if self.prediction.target_metric != self.proposal.primary_metric_key:
            raise ValueError("prediction.target_metric must equal the primary metric key")
        return self
