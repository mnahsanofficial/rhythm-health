import type { Experiment, ExperimentTimeline } from "@rhythm-health/contract";

export type RunningExperiment = { experiment: Experiment; timeline: ExperimentTimeline };
export const experimentName = ({ experiment }: RunningExperiment) => experiment.intervention.short_name?.trim() || "Your experiment";
export const experimentPath = ({ experiment }: RunningExperiment) => `/experiments/${encodeURIComponent(experiment.id)}`;
export const recordedToday = ({ timeline }: RunningExperiment) => timeline.progress.day_number !== null
  && timeline.days.some(day => day.day_number === timeline.progress.day_number && day.state === "recorded");
export const lastDayRecorded = (entry: RunningExperiment) => entry.timeline.progress.state === "in_progress"
  && entry.timeline.progress.days_remaining === 0 && recordedToday(entry);
export const readyForResults = (entry: RunningExperiment) => entry.timeline.progress.state === "ended"
  || entry.timeline.progress.state === "completed" || lastDayRecorded(entry);
export const closesAt = ({ timeline }: RunningExperiment) => timeline.next_day_at
  ?? (timeline.progress.day_number === timeline.progress.total_days ? timeline.progress.ends_at : null);

/** Order real due check-ins by the server's closing time. Samples never displace a real experiment. */
export function orderExperiments(entries: RunningExperiment[]) {
  const priority = (entry: RunningExperiment) => entry.experiment.is_seeded ? 4
    : entry.timeline.progress.state === "in_progress" && !recordedToday(entry) ? 0
    : readyForResults(entry) ? 1 : recordedToday(entry) ? 2 : 3;
  const deadline = (entry: RunningExperiment) => {
    const value = closesAt(entry);
    return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.MAX_SAFE_INTEGER;
  };
  return [...entries].sort((a, b) => priority(a) - priority(b) || deadline(a) - deadline(b));
}

/** A count for one experiment's rolling seven days, never a sum across experiments. */
export function weeklyCount({ timeline }: RunningExperiment) {
  const day = timeline.progress.day_number;
  if (timeline.progress.state !== "in_progress" || day === null) return null;
  return timeline.days.filter(item => item.day_number <= day && item.day_number > day - 7 && item.state === "recorded").length;
}

export const dayLabel = ({ timeline }: RunningExperiment) => {
  const progress = timeline.progress;
  return progress.day_number !== null ? `Day ${progress.day_number} of ${progress.total_days}`
    : progress.state === "completed" ? "Completed" : progress.state === "ended" ? "All days done" : "Not started";
};
export const displayTime = (value: string) => new Date(value).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
