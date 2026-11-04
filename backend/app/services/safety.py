import re

from app.schemas.classification import Classification
from app.schemas.safety import SafetyDecision

# Deterministic backend rules (TRD 15). Deliberately conservative: a false block just
# asks the user to reword; a false allow could put someone in an unsafe experiment.

_SLEEP_HOURS = re.compile(
    r"\b(?:sleep(?:ing)?|slept|sleeps)\b[^.?!]{0,40}?\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b",
    re.IGNORECASE,
)
_FAST_HOURS = re.compile(
    r"\b(?:fast(?:ing)?|without eating|no food)\b[^.?!]{0,30}?\b(\d+)\s*(?:hours?|hrs?|h|days?)\b",
    re.IGNORECASE,
)
_CALORIES = re.compile(r"\b(\d{3,4})\s*(?:kcal|calories|cals)\b", re.IGNORECASE)

_SLEEP_ALTERNATIVE = (
    "Test whether moving your bedtime 30 minutes earlier affects morning energy."
)
_SLEEP_QUESTION = "Does going to bed 30 minutes earlier improve my morning energy?"
_FOOD_QUESTION = "Does finishing dinner 2 hours before bed improve my sleep?"
_BLOCKED_QUESTION = "Does a consistent bedtime help me feel rested?"

_KEYWORD_RULES: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        re.compile(r"\b(?:all[- ]nighters?|no sleep|skip(?:ping)? sleep|stay(?:ing)? up all night)\b", re.I),
        "This experiment would involve unsafe sleep restriction.",
        _SLEEP_ALTERNATIVE,
        _SLEEP_QUESTION,
    ),
    (
        re.compile(
            r"\b(?:medication|medicine|prescription|antidepressants?|insulin|dosage|"
            r"(?:stop|quit|skip|change|increase|reduce)\w*\s+(?:my\s+)?(?:meds|pills))\b",
            re.I,
        ),
        "Changes involving medication need a clinician, not a self-experiment.",
        "Test a non-medical routine, such as a consistent wake time, and keep your medication as prescribed.",
        "Does a consistent wake time improve my morning energy?",
    ),
    (
        re.compile(r"\b(?:water fast|dry fast|starv\w+|eat nothing|purg\w+)\b", re.I),
        "This experiment would involve unsafe fasting or food restriction.",
        "Test a gentler change, such as finishing dinner 2 hours before bed.",
        _FOOD_QUESTION,
    ),
    (
        re.compile(
            r"\b(?:until i (?:pass out|collapse|vomit|faint)|through (?:the )?(?:pain|injury)|to exhaustion)\b",
            re.I,
        ),
        "This experiment would involve exercise that risks injury.",
        "Test a moderate routine, such as a 20-minute walk, at a comfortable effort.",
        "Does a 20-minute walk at a comfortable pace improve my energy?",
    ),
    (
        re.compile(
            r"\b(?:cocaine|meth\w*|amphetamines?|adderall|ketamine|opioids?|heroin|binge[- ]?drink\w*)\b",
            re.I,
        ),
        "This experiment would involve unsafe substance use.",
        "Test reducing caffeine after 2 PM instead.",
        "Does cutting caffeine after 2 PM improve my sleep?",
    ),
]


def check_text(text: str) -> SafetyDecision:
    """Apply the backend rules to free text (the user's question, or a generated proposal)."""
    for match in _SLEEP_HOURS.finditer(text):
        if float(match.group(1)) < 5:
            return _block("This experiment would involve unsafe sleep restriction.", _SLEEP_ALTERNATIVE, _SLEEP_QUESTION)
    for match in _FAST_HOURS.finditer(text):
        hours = int(match.group(1)) * (24 if "day" in match.group(0).lower() else 1)
        if hours >= 24:
            return _block(
                "This experiment would involve unsafe fasting or food restriction.",
                "Test a gentler change, such as finishing dinner 2 hours before bed.",
                _FOOD_QUESTION,
            )
    for match in _CALORIES.finditer(text):
        if int(match.group(1)) < 1200:
            return _block(
                "This experiment would involve unsafe food restriction.",
                "Test a gentler change, such as finishing dinner 2 hours before bed.",
                _FOOD_QUESTION,
            )
    for pattern, reason, alternative, question in _KEYWORD_RULES:
        if pattern.search(text):
            return _block(reason, alternative, question)
    return SafetyDecision(allowed=True)


def evaluate(question: str, classification: Classification) -> SafetyDecision:
    """Decide whether to generate an experiment for this question."""
    decision = check_text(question)
    if not decision.allowed:
        return decision
    if classification.risk == "blocked":
        return _block(
            "This request isn't suitable for a lightweight self-experiment.",
            "Try a small, low-risk habit change, such as a consistent bedtime, and ask a clinician about anything medical.",
            _BLOCKED_QUESTION,
        )
    if classification.risk == "review":
        return SafetyDecision(
            allowed=True,
            reason="Keep this experiment gentle, and stop if you feel unwell.",
        )
    return SafetyDecision(allowed=True)


def _block(reason: str, alternative: str, question: str) -> SafetyDecision:
    return SafetyDecision(allowed=False, reason=reason, suggested_alternative=alternative, suggested_question=question)
