"""Isolated S8 fixture from the real deterministic backend; no settings or network."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))
from app.services.analysis import baseline_summary  # noqa: E402

row = {"baseline_days": 3, "metrics": [
    {"key": "morning_energy", "label": "Morning energy", "type": "scale", "min": 1, "max": 10, "primary": True},
    {"key": "breaks", "label": "Breaks", "type": "number", "min": None, "max": None, "primary": False},
    {"key": "sleep_time", "label": "Time to fall asleep", "type": "duration", "min": None, "max": None, "primary": False},
    {"key": "screen_free", "label": "Screen-free evening", "type": "boolean", "min": None, "max": None, "primary": False},
]}
checkins = [
    {"day_number": 1, "phase": "baseline", "metric_values": {"morning_energy": 5, "breaks": 0, "sleep_time": 15, "screen_free": False}},
    {"day_number": 3, "phase": "baseline", "metric_values": {"morning_energy": 6, "breaks": 2, "sleep_time": 25.5, "screen_free": True}},
    {"day_number": 4, "phase": "intervention", "metric_values": {"morning_energy": 10, "breaks": 9, "sleep_time": 1, "screen_free": True}},
]
print(json.dumps(baseline_summary(row, checkins).model_dump(mode="json"), ensure_ascii=False, indent=2))
