"""The seeded demo experiment (PRD 18, TRD 29): a finished walk-after-dinner run.

It is stored in the normal tables and goes through the normal analysis, so it behaves
like any completed experiment. Only the check-in values and the written narrative are
fixed here; every number in the report is computed.
"""

from datetime import datetime, timedelta

from app.schemas.lab_report import ReportNarrative

QUESTION = "Does a 20-minute walk after dinner improve my morning energy?"
CATEGORY = "energy"

BASELINE_DAYS = 3
INTERVENTION_DAYS = 7

# Each run is finished a day ago, so the dates in the demo always look recent.
FINISHED_DAYS_AGO = 1

EXPERIMENT = {
    "status": "completed",
    "is_seeded": True,
    "question": QUESTION,
    "category": CATEGORY,
    "hypothesis": "Light movement in the evening may help you wake up with more energy.",
    "intervention": {
        "action": "Take a relaxed 20-minute walk",
        "timing": "Within an hour after dinner",
        "frequency": "daily",
    },
    "baseline_days": BASELINE_DAYS,
    "intervention_days": INTERVENTION_DAYS,
    "metrics": [
        {"key": "morning_energy", "label": "Morning energy", "type": "scale", "min": 1, "max": 10, "primary": True},
        {"key": "sleep_quality", "label": "Sleep quality", "type": "scale", "min": 1, "max": 10, "primary": False},
    ],
    "success_criteria": {"primary_metric": "morning_energy", "minimum_change_percent": 10},
    "prediction": {
        "target_metric": "morning_energy",
        "direction": "increase",
        "expected_change_min": 8,
        "expected_change_max": 15,
        "confidence": "moderate",
        "reasoning": "A light evening walk adds gentle movement without cutting into sleep, which often lifts next-morning energy a little.",
        "uncertainty_factors": [
            "Dinner and bedtime timing varied",
            "Self-rated scores are subjective",
            "Only three baseline days",
        ],
    },
}

# (morning_energy, sleep_quality, walked, note) for days 1-10. Day 7 is a skipped walk.
_DAYS = [
    (5, 6, None, "Slow start, long day yesterday."),
    (6, 6, None, None),
    (6, 7, None, None),
    (6, 7, True, "First walk, felt calm afterwards."),
    (6, 6, True, None),
    (7, 7, True, "Woke up before the alarm."),
    (6, 7, False, "Rained, skipped the walk."),
    (6, 6, True, None),
    (7, 7, True, "Good morning, easy to get going."),
    (6, 7, True, None),
]


def checkins() -> list[dict]:
    """Check-in rows without the experiment id, in the same shape the app stores."""
    rows = []
    for day, (energy, sleep, walked, note) in enumerate(_DAYS, start=1):
        rows.append(
            {
                "day_number": day,
                "phase": "baseline" if day <= BASELINE_DAYS else "intervention",
                "intervention_completed": bool(walked),
                "metric_values": {"morning_energy": energy, "sleep_quality": sleep},
                "note": note,
            }
        )
    return rows


def timeline(now: datetime) -> tuple[datetime, datetime]:
    """started_at and completed_at: ten full days, ending FINISHED_DAYS_AGO days before now."""
    completed_at = now - timedelta(days=FINISHED_DAYS_AGO)
    return completed_at - timedelta(days=BASELINE_DAYS + INTERVENTION_DAYS), completed_at


def narrative() -> ReportNarrative:
    return ReportNarrative.model_validate(
        {
            "summary": "Morning energy was about 11% higher on walking days than on your normal days, in line with the forecast.",
            "interpretation": (
                "Your morning energy averaged about 5.7 over the three normal days and about 6.3 on the seven walking days. "
                "The rise was steady rather than driven by one good morning, and it landed inside the forecast of 8% to 15%. "
                "Seven days is a short test, so treat this as a pattern worth watching rather than a settled answer."
            ),
            "personal_learnings": [
                "A short walk after dinner went along with higher morning energy for you.",
                "Sleep quality edged up too, by less than energy did, so better sleep alone does not explain the lift.",
                "The one skipped walk, on a rainy night, was followed by an ordinary morning.",
            ],
            "confounders": [
                "Dinner and bedtime varied from day to day.",
                "Energy ratings are subjective and a three-day baseline is short.",
            ],
            "next_experiment": {
                "question": "Does walking right after dinner help more than walking later in the evening?",
                "reason": "You already know a walk seems to help. Testing when you walk could show whether timing matters.",
            },
        }
    )
