"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import type { Checkin, Experiment, MetricAnalysis, MetricValue, PredictionComparison } from "@/lib/types/api";

type Props = {
  experiment: Experiment;
  checkins: Checkin[];
  primary: MetricAnalysis;
  comparison: PredictionComparison | null;
};

function numeric(v: MetricValue | undefined): number | null {
  if (v === undefined) return null;
  return typeof v === "boolean" ? (v ? 1 : 0) : v;
}

/**
 * PRD §15 section 5: the primary metric day by day. Baseline and test days, skipped days,
 * the baseline average and the predicted range, with each day tappable for its values and note.
 * The SVG stretches to fit; points and labels are HTML so they stay readable and focusable.
 */
export function DayChart({ experiment, checkins, primary, comparison }: Props) {
  const reduce = useReducedMotion();
  const panelId = useId();
  const [open, setOpen] = useState<number | null>(null);
  const metric = experiment.metrics.find((m) => m.key === primary.key);
  const total = experiment.baseline_days + experiment.intervention_days;
  const byDay = new Map(checkins.map((c) => [c.day_number, c]));
  const points = checkins
    .map((c) => ({ c, v: numeric(c.metric_values[primary.key]) }))
    .filter((p): p is { c: Checkin; v: number } => p.v !== null)
    .sort((a, b) => a.c.day_number - b.c.day_number);

  // Predicted range in the metric's own units: baseline mean shifted by the predicted percents.
  const base = primary.baseline.mean;
  const band =
    comparison && base !== null
      ? {
          lo: base + (Math.abs(base) * comparison.predicted_min) / 100,
          hi: base + (Math.abs(base) * comparison.predicted_max) / 100,
        }
      : null;

  const values = [...points.map((p) => p.v), ...(base !== null ? [base] : []), ...(band ? [band.lo, band.hi] : [])];
  let lo = metric?.type === "scale" && metric.min !== null ? metric.min : Math.min(...values);
  let hi = metric?.type === "scale" && metric.max !== null ? metric.max : Math.max(...values);
  if (!(hi > lo)) {
    lo -= 1;
    hi += 1;
  }
  const x = (day: number) => ((day - 0.5) / total) * 100;
  const y = (v: number) => 100 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const testStart = (experiment.baseline_days / total) * 100;

  // One line per run of consecutive logged days, so a missed day leaves a visible gap.
  const runs: { day: number; v: number }[][] = [];
  for (const p of points) {
    const last = runs.at(-1);
    if (last && last.at(-1)!.day === p.c.day_number - 1) last.push({ day: p.c.day_number, v: p.v });
    else runs.push([{ day: p.c.day_number, v: p.v }]);
  }

  const selected = open !== null ? byDay.get(open) : undefined;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <section aria-labelledby="chart-heading" className="rounded-card border border-line bg-paper p-6 sm:p-8">
      <h2 id="chart-heading" className="font-display text-title">
        Day by day
      </h2>
      <p className="mt-1 text-body text-muted">{primary.label}</p>

      <div className="mt-6 flex gap-3">
        <div aria-hidden="true" className="relative w-6 shrink-0 font-mono text-caption text-muted">
          <span className="absolute top-0 right-0 -translate-y-1/2">{fmt(hi)}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">{fmt(lo)}</span>
        </div>
        <div className="relative aspect-[4/3] min-w-0 flex-1 sm:aspect-[5/2]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <rect x={testStart} y={0} width={100 - testStart} height={100} fill="var(--color-moss-tint)" opacity={0.6} />
            {band && (
              <rect
                x={testStart}
                y={y(Math.max(band.lo, band.hi))}
                width={100 - testStart}
                height={Math.abs(y(band.lo) - y(band.hi))}
                fill="var(--color-night)"
                opacity={0.14}
              />
            )}
            {runs.map((run, i) =>
              run.length > 1 ? (
                <motion.polyline
                  key={i}
                  points={run.map((p) => `${x(p.day)},${y(p.v)}`).join(" ")}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeOpacity={0.55}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  // Fade, not pathLength: dash-based drawing breaks with non-scaling strokes on a stretched SVG.
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * i }}
                />
              ) : null,
            )}
          </svg>

          {/* HTML, not SVG: dash spacing would stretch with the chart's width. */}
          {base !== null && (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-ink/50"
              style={{ top: `${y(base)}%` }}
            />
          )}
          {points.map(({ c, v }) => {
            const test = c.phase === "intervention";
            const skipped = test && !c.intervention_completed;
            const label = `Day ${c.day_number}, ${test ? "test" : "baseline"}${skipped ? ", change skipped" : ""}: ${fmt(v)}`;
            return (
              <button
                key={c.day_number}
                type="button"
                aria-label={label}
                aria-expanded={open === c.day_number}
                aria-controls={panelId}
                onClick={() => setOpen(open === c.day_number ? null : c.day_number)}
                className="group absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{ left: `${x(c.day_number)}%`, top: `${y(v)}%` }}
              >
                <span
                  className={`block rounded-full border-2 transition-[scale] group-hover:scale-125 ${
                    open === c.day_number ? "size-4 ring-2 ring-sun ring-offset-1" : "size-3.5"
                  } ${
                    !test ? "border-night bg-night" : skipped ? "border-moss bg-paper" : "border-moss bg-moss"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div aria-hidden="true" className="mt-2 ml-9 flex font-mono text-caption text-muted">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="flex-1 text-center tabular-nums">
            {i + 1}
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 ml-9 flex text-caption">
        <span className="text-night" style={{ width: `${testStart}%` }}>
          Baseline
        </span>
        <span className="flex-1 text-moss">Test</span>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-night" /> Baseline day
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-moss" /> Made the change
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-moss bg-paper" /> Skipped the change
        </li>
        {base !== null && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t border-dashed border-ink/60" /> Baseline average
          </li>
        )}
        {band && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 bg-night/15" /> Predicted range
          </li>
        )}
      </ul>

      <div id={panelId} aria-live="polite">
        <AnimatePresence initial={false} mode="wait">
          {selected ? (
            <motion.div
              key={selected.day_number}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="mt-5 rounded-card bg-oat p-4"
            >
              <p className="font-mono text-caption text-moss">
                Day {selected.day_number} · {selected.phase === "intervention" ? "Test" : "Baseline"}
                {selected.phase === "intervention" && (selected.intervention_completed ? " · made the change" : " · skipped the change")}
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {experiment.metrics.map((m) => {
                  const v = selected.metric_values[m.key];
                  return v === undefined ? null : (
                    <div key={m.key} className="flex justify-between gap-4">
                      <dt className="text-muted">{m.label}</dt>
                      <dd className="shrink-0 font-mono tabular-nums">{typeof v === "boolean" ? (v ? "Yes" : "No") : v}</dd>
                    </div>
                  );
                })}
              </dl>
              {selected.note && <p className="mt-3 border-t border-line pt-3">“{selected.note}”</p>}
            </motion.div>
          ) : (
            <p className="mt-5 text-caption text-muted">Tap a day to see what you recorded.</p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
