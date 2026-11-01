"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import type { ChartData, ChartPoint } from "@/lib/types/api";

type Props = {
  chart: ChartData;
};

type Plotted = { p: ChartPoint; v: number };

const listDays = (days: number[]) => `${days.length === 1 ? "day" : "days"} ${days.join(", ")}`;

/**
 * PRD §15 section 5: the primary metric day by day, drawn from the backend's chart data. Baseline
 * and test days, the baseline average and the predicted range, with each logged day tappable for
 * its values and note. Nothing is recalculated here. The SVG stretches to fit; points and labels
 * are HTML so they stay readable and focusable.
 */
export function DayChart({ chart }: Props) {
  const reduce = useReducedMotion();
  const panelId = useId();
  const [open, setOpen] = useState<number | null>(null);
  const metric = chart.primary_metric;
  const total = chart.baseline_days + chart.intervention_days;
  const byDay = new Map(chart.points.map((p) => [p.day, p]));
  const points: Plotted[] = chart.points
    .filter((p): p is ChartPoint & { value: number } => p.logged && p.value !== null)
    .map((p) => ({ p, v: p.value }));
  const missed = new Set(chart.points.filter((p) => !p.logged && p.missed).map((p) => p.day));
  const unlogged = chart.points.filter((p) => !p.logged).map((p) => p.day);
  const missedDays = unlogged.filter((day) => missed.has(day));
  const notReached = unlogged.filter((day) => !missed.has(day));

  const base = chart.baseline_mean;
  const band = chart.predicted_band ? { lo: chart.predicted_band.expected_value_min, hi: chart.predicted_band.expected_value_max } : null;

  const values = [...points.map((p) => p.v), ...(base !== null ? [base] : []), ...(band ? [band.lo, band.hi] : [])];
  let lo = metric.type === "scale" && metric.min !== null ? metric.min : Math.min(...values);
  let hi = metric.type === "scale" && metric.max !== null ? metric.max : Math.max(...values);
  if (!(hi > lo)) {
    lo -= 1;
    hi += 1;
  }
  const x = (day: number) => ((day - 0.5) / total) * 100;
  const y = (v: number) => 100 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const testStart = (chart.baseline_days / total) * 100;

  // One line per run of consecutive logged days, so a missed day leaves a visible gap.
  const runs: { day: number; v: number }[][] = [];
  for (const p of points) {
    const last = runs.at(-1);
    if (last && last.at(-1)!.day === p.p.day - 1) last.push({ day: p.p.day, v: p.v });
    else runs.push([{ day: p.p.day, v: p.v }]);
  }

  const selected = open !== null ? byDay.get(open) : undefined;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <section aria-labelledby="chart-heading" className="rounded-card border border-line bg-paper p-6 sm:p-8">
      <h2 id="chart-heading" className="font-display text-title">
        Day by day
      </h2>
      <p className="mt-1 text-body text-muted">{metric.label}</p>

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
          {points.map(({ p, v }) => {
            const test = p.phase === "intervention";
            const skipped = test && !p.intervention_completed;
            const label = `Day ${p.day}, ${test ? "test" : "baseline"}${skipped ? ", change skipped" : ""}: ${fmt(v)}`;
            return (
              <button
                key={p.day}
                type="button"
                aria-label={label}
                aria-expanded={open === p.day}
                aria-controls={panelId}
                onClick={() => setOpen(open === p.day ? null : p.day)}
                className="group absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{ left: `${x(p.day)}%`, top: `${y(v)}%` }}
              >
                <span
                  className={`block rounded-full border-2 transition-[scale] group-hover:scale-125 ${
                    open === p.day ? "size-4 ring-2 ring-sun ring-offset-1" : "size-3.5"
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
          <span key={i} className={`flex-1 text-center tabular-nums ${missed.has(i + 1) ? "text-clay line-through" : !byDay.get(i + 1)?.logged ? "opacity-40" : ""}`}>
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
            <span aria-hidden="true" className="h-2.5 w-4 bg-night/15" /> Predicted range: {fmt(band.lo)}–{fmt(band.hi)}
          </li>
        )}
      </ul>
      {(missedDays.length > 0 || notReached.length > 0) && (
        <div className="mt-3 text-caption text-muted">
          {missedDays.length > 0 && <p>Missed: {listDays(missedDays)}.</p>}
          {notReached.length > 0 && <p>Not reached before you finished: {listDays(notReached)}.</p>}
        </div>
      )}

      <div id={panelId} aria-live="polite">
        <AnimatePresence initial={false} mode="wait">
          {selected ? (
            <motion.div
              key={selected.day}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="mt-5 rounded-card bg-oat p-4"
            >
              <p className="font-mono text-caption text-moss">
                Day {selected.day} · {selected.phase === "intervention" ? "Test" : "Baseline"}
                {selected.phase === "intervention" && (selected.intervention_completed ? " · made the change" : " · skipped the change")}
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {chart.metrics.map((m) => {
                  const v = selected.values?.[m.key];
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
