"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { signedPercent } from "@/lib/report/copy";
import type { PredictionComparison } from "@/lib/types/api";

/** The original prediction stays fixed; a user action reveals the measured comparison. */
export function PredictionVsReality({ comparison, metricLabel }: { comparison: PredictionComparison; metricLabel: string }) {
  const reduce = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const resultId = useId();
  const revealed = replay > 0;
  const { predicted_min: min, predicted_max: max, observed_change_percent: observed } = comparison;
  const lo = Math.min(0, min, observed);
  const hi = Math.max(0, max, observed);
  const pad = Math.max((hi - lo) * 0.15, 4);
  const from = lo - pad;
  const to = hi + pad;
  const at = (v: number) => ((v - from) / (to - from)) * 100;
  const landing = {
    initial: reduce ? false as const : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <section aria-labelledby="pvr-heading" className="rounded-card border-t-4 border-night bg-paper p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-caption font-medium text-night">Your question, put to the test</p>
          <h2 id="pvr-heading" className="mt-2 font-display text-headline tracking-tight">Prediction vs reality</h2>
          <p className="mt-2 text-body text-muted">{metricLabel} · change from baseline</p>
        </div>
        <button
          type="button"
          aria-controls={resultId}
          onClick={() => setReplay(n => n + 1)}
          className="min-h-12 rounded-pill bg-moss px-6 font-medium text-paper transition-transform hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none"
        >
          {revealed ? "Replay comparison" : "Reveal my result"}
        </button>
      </div>
      <dl className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card bg-night-tint p-5 sm:p-6">
          <dt className="text-body text-night">We predicted</dt>
          <dd className="mt-2">
            <span className="block font-mono text-headline tracking-tight tabular-nums sm:text-display-sm">{signedPercent(min)} to {signedPercent(max)}</span>
            <p className="mt-2 text-caption text-muted">Recorded before your experiment began.</p>
          </dd>
        </div>
        <div id={resultId} className="min-h-40 rounded-card bg-moss-tint p-5 sm:p-6">
          <dt className="text-body text-moss">You saw</dt>
          <dd className="mt-2">
            {revealed ? (
              <motion.span key={replay} {...landing} className="block font-mono text-headline tracking-tight tabular-nums sm:text-display-sm">
                {signedPercent(observed)}
              </motion.span>
            ) : <span className="block text-lead text-muted">Your observations are ready.</span>}
            <p className="mt-2 text-caption text-muted">Measured from your recorded days.</p>
          </dd>
        </div>
      </dl>
      <p role="status" className="mt-4 min-h-7 text-body font-medium">
        {revealed ? `Your result, ${signedPercent(observed)}, landed ${comparison.within_predicted_range ? "inside" : "outside"} the predicted range.` : "Compare the original forecast with what you recorded."}
      </p>
      <div
        className="relative mt-5 h-16"
        role="img"
        aria-label={`Predicted range ${signedPercent(min)} to ${signedPercent(max)}${revealed ? `; observed ${signedPercent(observed)}` : "; reveal to compare your result"}.`}
      >
        <div className="absolute inset-x-0 top-6 h-2 rounded-pill bg-line" />
        <div className="absolute top-6 h-2 rounded-pill bg-night" style={{ left: `${at(min)}%`, width: `${Math.max(at(max) - at(min), 1)}%` }} />
        <div className="absolute top-4 h-6 w-px bg-ink/40" style={{ left: `${at(0)}%` }} />
        <span className="absolute top-11 -translate-x-1/2 font-mono text-caption text-muted" style={{ left: `${at(0)}%` }}>0%</span>
        {revealed && (
          <motion.div key={replay} {...landing} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${at(observed)}%` }}>
            <span className="block font-mono text-caption font-medium text-moss">You</span>
            <span className="mx-auto mt-0.5 block size-4 rounded-pill border-2 border-paper bg-moss" />
          </motion.div>
        )}
      </div>
      <p className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-muted">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-5 rounded-pill bg-night" />Predicted range</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-pill bg-moss" />What you saw</span>
      </p>
      <div className="mt-6 grid min-h-28 items-start gap-3 border-t border-line pt-5 sm:grid-cols-[auto_1fr] sm:gap-8">
        <p>
          <span className="block text-caption text-muted">Prediction accuracy</span>
          <span className="font-mono text-title tabular-nums">{revealed ? `${Math.round(comparison.accuracy_percent)}%` : "Ready to compare"}</span>
        </p>
        <p className="max-w-md text-caption text-muted">How close the forecast was to the measured change. This is not scientific confidence. A short personal experiment shows a pattern, not proof.</p>
      </div>
    </section>
  );
}
