import { useId } from "react";
import type { ExperimentTimeline } from "@rhythm-health/contract";

/** Observations and copy are computed by the backend, never inferred here. */
export function BaselineContext({ timeline }: { timeline: ExperimentTimeline }) {
  const heading = useId();
  const summary = timeline.baseline_summary;
  if (!summary || timeline.progress.state !== "in_progress" || timeline.progress.phase !== "intervention") return null;

  return (
    <section aria-labelledby={heading} className="mt-6 border-t border-line py-6">
      <h2 id={heading} className="font-display text-title">Your normal, before the change.</h2>
      {summary.days_recorded === 0 ? (
        <p className="mt-3 text-body text-muted">
          No normal-day answers were recorded. There is no personal baseline to compare with yet.
        </p>
      ) : (
        <>
          <p className="mt-2 text-caption text-muted">
            {summary.days_recorded} of {summary.days_planned} normal {summary.days_planned === 1 ? 'day' : 'days'} recorded.
          </p>
          <ul className="mt-4 space-y-3 text-body">
            {summary.metrics.map((metric) => <li key={metric.key}>{metric.description}</li>)}
          </ul>
          {summary.days_recorded < summary.days_planned && (
            <p className="mt-3 text-caption text-muted">Some normal days are missing, so this starting point is limited.</p>
          )}
        </>
      )}
    </section>
  );
}
