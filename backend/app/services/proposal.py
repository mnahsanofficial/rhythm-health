from pydantic import BaseModel

from app.integrations import jev
from app.schemas.classification import Classification
from app.schemas.experiment import ExperimentProposal
from app.schemas.prediction import Prediction
from app.schemas.profile import ProfileOut
from app.schemas.safety import SafetyDecision
from app.services import experiment_designer, history, safety


class ProposeResponse(BaseModel):
    personal_guess_available: bool = False
    proposal: ExperimentProposal | None = None
    prediction: Prediction | None = None
    safety: SafetyDecision
    # Returned so the later "save experiment" step can store the category.
    classification: Classification


def propose(question: str, profile: ProfileOut) -> ProposeResponse:
    """Classify, safety-check, then design and predict in one call. Nothing is persisted."""
    classification = jev.classify(question)

    decision = safety.evaluate(question, classification)
    if not decision.allowed:
        return ProposeResponse(safety=decision, classification=classification)

    past = history.load(str(profile.id), classification.category)
    designed = experiment_designer.design(question, profile, classification, past)
    proposal, prediction = designed.proposal, designed.prediction

    # The model's own output goes through the same rules before the user sees it.
    generated = safety.check_text(proposal.model_dump_json())
    if not generated.allowed:
        return ProposeResponse(safety=generated, classification=classification)

    return ProposeResponse(
        proposal=proposal,
        prediction=prediction,
        safety=decision,
        classification=classification,
    )
