"""Deterministic N-of-1 analysis (TRD 21-23). No LLM, no clinical claims.

The thresholds are named in thresholds.py so the behaviour is easy to read and test.
"""

from app.services.analysis.adherence import adherence_for
from app.services.analysis.baseline import baseline_summary
from app.services.analysis.core import analyze
from app.services.analysis.counts import checkin_counts, required_checkins
from app.services.analysis.overlaps import experiment_overlaps
from app.services.analysis.prediction import prediction_accuracy
from app.services.analysis.signal import classify_signal

__all__ = [
    "adherence_for",
    "analyze",
    "baseline_summary",
    "checkin_counts",
    "classify_signal",
    "experiment_overlaps",
    "prediction_accuracy",
    "required_checkins",
]
