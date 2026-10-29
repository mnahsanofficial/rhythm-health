"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { signedPercent } from "@/lib/report/copy";
import type { PredictionComparison } from "@/lib/types/api";

/** PRD §15 sections 2–4 and 8: the forecast, what happened, and how close it was. */
export function PredictionVsReality({ comparison, metricLabel }: { comparison: PredictionComparison; metricLabel: string }) {
  const { predicted_min: min, predicted_max: max, observed_change_percent: observed } = comparison;
  // A scale that always shows 0, the whole predicted range and the observation, with some room.
  const lo = Math.min(0, min, observed);
  const hi = Math.max(0, max, observed);
  const pad = Math.max((hi - lo) * 0.15, 4);
  const from = lo - pad;
  const to = hi + pad;
  const at = (v: number) => ((v - from) / (to - from)) * 100;

  return (
    <section aria-labelledby="pvr-heading" className="rounded-card border border-line bg-paper p-6 sm:p-8">
      <h2 id="pvr-heading" className="font-display text-title">
        Prediction vs reality
      </h2>
      <p className="mt-1 text-body text-muted">{metricLabel}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-card bg-oat p-4">
          <dt className="text-caption text-muted">We predicted</dt>
          <dd className="mt-1 font-display text-headline tabular-nums">
            {signedPercent(min)} to {signedPercent(max)}
          </dd>
        </div>
        <div className="rounded-card bg-moss-tint p-4">
          <dt className="text-caption text-muted">You saw</dt>
          <dd className="mt-1 font-display text-headline tabular-nums">
            <CountUp to={observed} format={signedPercent} />
          </dd>
        </div>
      </dl>

      <div
        className="relative mt-8 h-14"
        role="img"
        aria-label={`Predicted range ${signedPercent(min)} to ${signedPercent(max)}; observed ${signedPercent(observed)}${comparison.within_predicted_range ? ", inside the range" : ", outside the range"}.`}
      >
        <div className="absolute inset-x-0 top-6 h-2 rounded-pill bg-line" />
        <motion.div
          className="absolute top-6 h-2 rounded-pill bg-night/70"
          style={{ left: `${at(min)}%`, width: `${Math.max(at(max) - at(min), 1)}%`, transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute top-4 h-6 w-px bg-ink/40" style={{ left: `${at(0)}%` }} />
        <span className="absolute top-11 -translate-x-1/2 font-mono text-caption text-muted" style={{ left: `${at(0)}%` }}>
          0%
        </span>
        <motion.div
          className="absolute top-0 -translate-x-1/2 text-center"
          style={{ left: `${at(observed)}%` }}
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.55, type: "spring", stiffness: 380, damping: 22 }}
        >
          <span className="block font-mono text-caption font-medium text-moss">You</span>
          <span className="mx-auto mt-0.5 block size-4 rounded-full border-2 border-paper bg-moss shadow" />
        </motion.div>
      </div>
      <p className="mt-2 flex items-center gap-4 text-caption text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-5 rounded-pill bg-night/70" /> Predicted range
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-moss" /> What you saw
        </span>
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-line pt-5">
        <p>
          <span className="block text-caption text-muted">Prediction accuracy</span>
          <span className="font-display text-headline tabular-nums">
            <CountUp to={comparison.accuracy_percent} format={(v) => `${Math.round(v)}%`} />
          </span>
        </p>
        <p className="max-w-sm pb-1 text-caption text-muted">
          How close the forecast was to what happened{comparison.within_predicted_range ? ", which landed inside the range" : ""}.
          This isn&apos;t scientific confidence.
        </p>
      </div>
    </section>
  );
}

/** A number that counts from zero once, so the result arrives rather than just appearing. */
function CountUp({ to, format }: { to: number; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const text = useTransform(value, format);
  useEffect(() => {
    if (reduce) {
      value.jump(to);
      return;
    }
    const a = animate(value, to, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => a.stop();
  }, [to, reduce, value]);
  return <motion.span>{text}</motion.span>;
}
