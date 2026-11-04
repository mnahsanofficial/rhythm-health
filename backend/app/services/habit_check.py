"""A soft check for questions that aren't about a habit. It never blocks: "Continue anyway" always works.

It reads the labels the classifier already returned, so it adds no paid call, and it runs before the
paid design call. A wrong label costs one extra tap. Safety is separate, and always comes first.
"""

from app.schemas.classification import Category, Classification
from app.schemas.safety import HabitCheck

MESSAGE = "This doesn't look like a habit question."

SUGGESTIONS: dict[Category, str] = {
    "sleep": "Does going to bed 30 minutes earlier improve my sleep?",
    "energy": "Does a 20-minute walk after dinner improve my morning energy?",
    "focus": "Does putting my phone away for an hour improve my focus?",
    "exercise": "Does a 10-minute walk after lunch improve my afternoon energy?",
    "nutrition": "Does having my last coffee before noon improve my sleep?",
    "stress": "Does 5 minutes of slow breathing after work lower my stress?",
    "routine": "Does a fixed wake-up time make my mornings easier?",
    "other": "Does a 20-minute walk after dinner improve my morning energy?",
}


def check(classification: Classification) -> HabitCheck | None:
    """Intent "other" is the classifier saying it's none of these. With category "other" too, a
    question or a goal has nothing about a habit in it. A proposed habit change always passes."""
    off_topic = classification.intent == "other" or (
        classification.category == "other" and classification.intent != "behavior_change"
    )
    if not off_topic:
        return None
    return HabitCheck(message=MESSAGE, suggested_question=SUGGESTIONS[classification.category])
