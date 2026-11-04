from datetime import datetime

from app.schemas.analysis import Analysis, PersonalGuessComparison
from app.schemas.experiment import Metric, SuccessCriteria
from app.schemas.prediction import Prediction
from app.services.analysis.adherence import adherence_for
from app.services.analysis.metrics import _analyze_metric
from app.services.analysis.numbers import _r
from app.services.analysis.overlaps import experiment_overlaps
from app.services.analysis.prediction import _compare_prediction
from app.services.analysis.signal import classify_signal


def analyze(
    experiment: dict,
    checkins: list[dict],
    completed_at: datetime | None = None,
    others: list[dict] | None = None,
) -> Analysis:
    metrics = [Metric.model_validate(m) for m in experiment["metrics"]]
    criteria = SuccessCriteria.model_validate(experiment["success_criteria"])
    prediction = Prediction.model_validate(experiment["prediction"])
    adherence = adherence_for(experiment, checkins, completed_at)
    results = [_analyze_metric(m, checkins) for m in metrics]
    primary = next(r for r in results if r.primary)

    comparison = _compare_prediction(primary, prediction)
    signal = classify_signal(
        primary,
        predicted_direction=prediction.direction,
        threshold_percent=criteria.minimum_change_percent,
        adherence_rate=adherence.adherence_rate,
    )
    return Analysis(
        primary_metric=primary.key,
        success_criteria_percent=criteria.minimum_change_percent,
        adherence=adherence,
        metrics=results,
        prediction=comparison,
        signal=signal,
        personal_guess=(PersonalGuessComparison(
            guessed_change_percent=experiment["personal_guess_percent"],
            observed_change_percent=primary.percent_change,
            error_points=(_r(primary.percent_change - experiment["personal_guess_percent"], 2)
                          if primary.percent_change is not None else None),
        ) if experiment.get("personal_guess_percent") is not None else None),
        overlaps=experiment_overlaps(experiment, checkins, others or [], completed_at),
    )
