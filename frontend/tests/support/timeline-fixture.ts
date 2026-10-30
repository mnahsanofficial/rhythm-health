import type { Experiment, ExperimentTimeline } from "@rhythm-health/contract";

/** Explicit test scenarios, never a clock-based substitute for the progress API.
 * Backend-generated early-finish/DST cases live in early-finish-reports.json.
 */
export function timelineFixture(
  experiment: Experiment,
  { recorded = [], missed = [], nextDayAt = null }: {
    recorded?: number[]; missed?: number[]; nextDayAt?: string | null;
  } = {},
): ExperimentTimeline {
  const days: ExperimentTimeline["days"] = Array.from({ length: experiment.progress.total_days }, (_, i) => ({
    day_number: i + 1,
    phase: i < experiment.baseline_days ? "baseline" : "test",
    state: recorded.includes(i + 1) ? "recorded" : missed.includes(i + 1) ? "missed"
      : experiment.progress.state === "completed" ? "not_observed"
      : experiment.progress.state === "in_progress" && experiment.progress.day_number === i + 1 ? "current" : "future",
  }));
  return {
    progress: experiment.progress,
    next_day_at: nextDayAt,
    recorded_days: recorded.length,
    missed_days: missed.length,
    remaining_days: days.filter(day => day.state === "current" || day.state === "future").length,
    days,
  };
}
