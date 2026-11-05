"""The short words a phone shows instead of the AI's long sentences.

New experiments get them from the design call, inside these limits. Experiments saved before that have none
stored, so these rules work them out each time they're read: no paid call, nothing written back, always an answer.
"""
import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

LABEL_WORDS, LABEL_CHARS = 4, 24  # "Minutes to fall asleep" is the longest one we ask for.
CHANGE_WORDS, CHANGE_CHARS = 6, 36
NAME_WORDS, NAME_CHARS = 5, 32
UNIT_CHARS = 8


def _at_most(words: int):
    def check(text: str) -> str:
        if len(text.split()) > words:
            raise ValueError(f"must be at most {words} words")
        return text
    return check


ShortLabel = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LABEL_CHARS), AfterValidator(_at_most(LABEL_WORDS)),
]
ChangeShort = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=CHANGE_CHARS), AfterValidator(_at_most(CHANGE_WORDS)),
]
ShortName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_CHARS), AfterValidator(_at_most(NAME_WORDS)),
]
Unit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=UNIT_CHARS)]

FALL_ASLEEP = "Minutes to fall asleep"
KNOWN_KEYS = {
    "morning_energy": "Morning energy",
    "afternoon_energy": "Afternoon energy",
    "energy": "Energy",
    "energy_level": "Energy",
    "sleep_quality": "Sleep quality",
    "focus": "Focus",
    "focus_level": "Focus",
    "mood": "Mood",
    "stress": "Stress",
    "stress_level": "Stress",
    "time_to_fall_asleep": FALL_ASLEEP,
    "minutes_to_fall_asleep": FALL_ASLEEP,
    "fall_asleep_minutes": FALL_ASLEEP,
    "sleep_latency": FALL_ASLEEP,
    "sleep_onset": FALL_ASLEEP,
    "sleep_onset_minutes": FALL_ASLEEP,
}
# More of these is worse: calling one "Energy" would say the opposite of what's measured.
MORE_IS_WORSE = re.compile(r"\b(crash\w*|slump\w*|dip\w*|tired\w*|fatigue\w*|drows\w*|grogg\w*)\b")
BY_MEANING = (
    (re.compile(r"\bfall(ing)? asleep\b|\bsleep (latency|onset)\b"), FALL_ASLEEP),
    (re.compile(r"\b(energy|energetic)\b.*\b(morning|wak\w+)\b|\b(morning|wak\w+)\b.*\b(energy|energetic)\b"), "Morning energy"),
    (re.compile(r"\b(energy|energetic)\b.*\bafternoon\b|\bafternoon\b.*\b(energy|energetic)\b"), "Afternoon energy"),
    (re.compile(r"\b(energy|energetic)\b"), "Energy"),
    (re.compile(r"\b(focus\w*|concentrat\w*)\b"), "Focus"),
    (re.compile(r"\bsleep quality\b|\bsleep well\b|\brested\b|\brestful\b"), "Sleep quality"),
    (re.compile(r"\bmood\b"), "Mood"),
    (re.compile(r"\bstress\w*\b"), "Stress"),
)
# A clause reads as finished just before one of these.
BREAK_BEFORE = {
    "about", "after", "and", "at", "before", "by", "during", "for", "from", "in",
    "on", "then", "so", "until", "while", "with", "within", "without",
}
# A clause never ends on one of these.
LOOSE_ENDS = BREAK_BEFORE | {"a", "an", "of", "the", "to", "my", "your"}


def _fits(words: list[str], max_words: int, max_chars: int) -> bool:
    return len(words) <= max_words and len(" ".join(words)) <= max_chars


def _sentence_case(text: str) -> str:
    return text[:1].upper() + text[1:]


def trim_clause(text: str, max_words: int, max_chars: int) -> str:
    """The first clause, cut where it still reads as a phrase. Never empty when `text` isn't."""
    clause = re.split(r"[.,;:!?()—–]|\s-\s", text.strip(), maxsplit=1)[0].strip() or text.strip()
    words = clause.split()
    if _fits(words, max_words, max_chars):
        return _sentence_case(clause)
    natural = [
        cut for cut in range(2, len(words))
        if words[cut].lower() in BREAK_BEFORE and words[cut - 1].lower() not in LOOSE_ENDS and _fits(words[:cut], max_words, max_chars)
    ]
    if natural:
        return _sentence_case(" ".join(words[:natural[-1]]))
    kept: list[str] = []
    for word in words:
        if not _fits([*kept, word], max_words, max_chars):
            break
        kept.append(word)
    while len(kept) > 1 and kept[-1].lower() in LOOSE_ENDS:
        kept.pop()
    return _sentence_case(" ".join(kept) if kept else clause[:max_chars].strip())


def short_label_for(key: str, label: str) -> str:
    """For a metric with no short label stored."""
    if key in KNOWN_KEYS:
        return KNOWN_KEYS[key]
    words = label.split()
    if _fits(words, LABEL_WORDS, LABEL_CHARS) and not label.rstrip().endswith("?"):
        return label.strip()
    named = key.replace("_", " ")
    text = f"{named} {label}".lower()
    if not MORE_IS_WORSE.search(text):
        for pattern, meaning in BY_MEANING:
            if pattern.search(text):
                return meaning
    if _fits(named.split(), LABEL_WORDS - 1, LABEL_CHARS):
        return _sentence_case(named)
    return trim_clause(label, LABEL_WORDS, LABEL_CHARS)


def unit_for(kind: str, low: float | None, high: float | None, key: str, label: str, given: str | None = None) -> str | None:
    """A scale's unit is its own top end, whatever was written, and a yes or no has none."""
    if kind == "boolean":
        return None
    if kind == "scale":
        return f"/{high:g}" if high is not None else given
    if given:
        return given
    if kind == "duration":
        return "min"
    text = f"{key} {label}".lower().replace("_", " ")
    if re.search(r"\b(minutes?|mins?|asleep)\b", text):
        return "min"
    if re.search(r"\bhours?\b", text):
        return "h"
    return None
