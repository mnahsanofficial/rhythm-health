from pydantic import BaseModel

from app.integrations import jev
from app.integrations.concurrency import read_together
from app.integrations.supabase import SupabaseUnavailable
from app.repositories import experiments
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


def running_questions(profile_id: str) -> list[dict]:
    """Questions already being asked, so a new experiment can reuse one and the person answers
    it once a day. A proposal does not depend on this: a failed read just means no suggestions."""
    try:
        rows = experiments.list_for_profile(profile_id, "active")
    except SupabaseUnavailable:
        return []
    fields = ("key", "label", "type", "min", "max", "min_label", "max_label")
    seen = {}
    for row in rows:
        if row.get("is_seeded"):
            continue
        for metric in row["metrics"]:
            item = {field: metric.get(field) for field in fields}
            seen.setdefault(tuple(item.values()), item)
    return list(seen.values())


async def propose(question: str, profile: ProfileOut) -> ProposeResponse:
    """Classify, safety-check, then design and predict in one call. Nothing is persisted."""
    classification = await jev.classify(question)

    decision = safety.evaluate(question, classification)
    if not decision.allowed:
        return ProposeResponse(safety=decision, classification=classification)

    profile_id = str(profile.id)
    past, running = await read_together(
        lambda: history.load(profile_id, classification.category),
        lambda: running_questions(profile_id),
    )
    designed = await experiment_designer.design(question, profile, classification, past, running)
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
