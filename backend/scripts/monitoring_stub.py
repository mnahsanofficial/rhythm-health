"""Fixed synthetic provider replies for the isolated failure drill only."""
import json

QUESTION = "Monitoring drill: Does a short evening walk change my energy?"
PLAN = {
    "proposal": {
        "question": QUESTION,
        "hypothesis": "Synthetic monitoring test only; this is not a personal health prediction.",
        "intervention": {"action": "Take a relaxed 20-minute walk", "timing": "After dinner", "frequency": "daily",
                         "change_short": "Take an evening walk", "short_name": "Monitoring test walk"},
        "baseline_days": 3, "intervention_days": 7,
        "metrics": [{"key": "drill_energy", "label": "Test energy rating", "short_label": "Test energy", "type": "scale",
                     "min": 1, "max": 10, "primary": True, "min_label": "Low energy", "max_label": "Full of energy", "unit": None}],
        "success_criteria": {"primary_metric": "drill_energy", "minimum_change_percent": 10},
    },
    "prediction": {"target_metric": "drill_energy", "direction": "no_change", "expected_change_min": -5,
                   "expected_change_max": 5, "confidence": "low", "reasoning": "Synthetic local-stub values for the monitoring drill only.",
                   "uncertainty_factors": ["Synthetic test account", "Not an actual model prediction"]},
}


def response_for(case: str, path: str) -> tuple[int, bytes]:
    if case == "ai-invalid":
        return 200, b"not json"
    if case != "plan":
        return 500, b'{"error":"local drill"}'
    if path == "/api/alpha/decisions":
        reply = {"answers": {k: {"type": "choice", "choice": v} for k, v in
                             {"category": "energy", "intent": "behavior_change", "risk": "low"}.items()}}
    else:
        reply = {"choices": [{"message": {"content": json.dumps(PLAN)}}]}
    return 200, json.dumps(reply).encode()
