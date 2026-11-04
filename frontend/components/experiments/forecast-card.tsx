"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { signedPercent } from "@/lib/report/copy";
import type { Experiment } from "@/lib/types/api";

function PredictionRange({ min, max }: { min: number; max: number }) {
  const reduce = useReducedMotion();
  const extent = Math.max(Math.abs(min), Math.abs(max), 1);
  const span = extent * 2;
  const position = (value: number) => ((value + extent) / span) * 100;
  const left = position(Math.min(min, max));
  const width = position(Math.max(min, max)) - left;
  const endpoint = Math.round(extent);

  return (
    <div className="mt-5" aria-label={`Expected change range ${signedPercent(min, 2)} to ${signedPercent(max, 2)}`}>
      <div className="relative h-3 rounded-pill bg-line">
        <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: "50%" }} />
        <motion.div
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal, ease: MOTION_EASE.settle }}
          style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, transformOrigin: "left" }}
          className="absolute inset-y-0 rounded-pill bg-night"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-caption text-muted">
        <span>{signedPercent(-endpoint, 2)}</span>
        <span>0%</span>
        <span>{signedPercent(endpoint, 2)}</span>
      </div>
    </div>
  );
}

export function ForecastCard({ prediction, metrics }: {
  prediction: Experiment["prediction"];
  metrics: Experiment["metrics"];
}) {
  const reduce = useReducedMotion();
  const metricLabel = metrics.find((metric) => metric.key === prediction.target_metric)?.label
    ?? prediction.target_metric;
  const directionText = {
    increase: "likely to go up",
    decrease: "likely to go down",
    no_change: "likely to stay about the same",
  }[prediction.direction];

  return (
    <div className="rounded-card border-t-4 border-night bg-night-tint p-5 sm:p-7">
      <p className="text-caption font-medium text-night">The original forecast</p>
      <h2 className="mt-2 font-display text-title">{metricLabel} is {directionText}</h2>
      <p className="mt-4 font-mono text-headline tracking-tight tabular-nums">
        <motion.span initial={reduce ? false : { opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : MOTION_DURATION.response }}>
          {signedPercent(prediction.expected_change_min, 2)} to {signedPercent(prediction.expected_change_max, 2)}
        </motion.span>
      </p>
      <PredictionRange min={prediction.expected_change_min} max={prediction.expected_change_max} />
      <p className="mt-5 text-caption text-muted">Confidence: <span className="font-medium capitalize text-ink">{prediction.confidence}</span></p>
      <p className="mt-3">{prediction.reasoning}</p>
      {prediction.uncertainty_factors.length > 0 && (
        <div className="mt-4">
          <p className="text-caption font-medium">Things that may affect the result</p>
          <ul className="mt-2 list-inside list-disc text-caption text-muted">
            {prediction.uncertainty_factors.map((factor) => <li key={factor}>{factor}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
