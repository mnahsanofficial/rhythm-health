"""Every threshold the analysis uses, named so its behaviour is easy to read and test."""

# Minimum check-ins per phase before an experiment can be completed (capped by the
# configured phase length, so the 1 + 2 day demo shape still works).
MIN_BASELINE_CHECKINS = 2
MIN_INTERVENTION_CHECKINS = 3

# Signal classification thresholds.
LIKELY_MIN_INTERVENTION_DAYS = 5
LIKELY_MIN_CONSISTENCY = 0.7
POSSIBLE_MIN_CONSISTENCY = 0.6
NOISE_MAX_CONSISTENCY = 0.5
LOW_ADHERENCE = 0.6
STRONG_EFFECT = 0.8  # |Cohen's d|
WEAK_EFFECT = 0.3
NO_CHANGE_BAND = 5.0  # percent: "no change" predictions are right inside +/- this

# Outlier detection: modified z-score (median/MAD), only with enough points.
OUTLIER_MIN_POINTS = 4
OUTLIER_Z = 3.5
