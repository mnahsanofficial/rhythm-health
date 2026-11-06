"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import type { MetricValue } from "@/lib/types/api";
import type { CheckinStep } from "./step-model";

/** Drawing only. It confirms an answer without judging it or deriving a health result. */
export function CheckinScene({ step, value, review = false }: { step?: CheckinStep; value?: MetricValue; review?: boolean }) {
  const reduce = useReducedMotion();
  const selected = review || value !== undefined;
  let rotation = 0;
  if (typeof value === "boolean") rotation = value ? 50 : -50;
  else if (typeof value === "number" && step?.kind === "metric" && step.metric.type === "scale") {
    const min = step.metric.min ?? 1, max = step.metric.max ?? 10;
    rotation = max > min ? -110 + Math.min(1, Math.max(0, (value - min) / (max - min))) * 220 : 0;
  }
  return <figure aria-hidden="true" className="relative flex min-w-0 items-center justify-center overflow-hidden rounded-card bg-chart-band/50 lg:min-h-96">
    <svg viewBox="0 0 480 340" className="h-44 w-full sm:h-56 lg:h-96">
      <ellipse cx="50" cy="370" rx="300" ry="130" fill="var(--color-moss)" opacity=".09" />
      <ellipse cx="450" cy="390" rx="310" ry="145" fill="var(--color-night)" opacity=".07" />
      <circle cx="240" cy="170" r="105" fill="none" stroke="var(--color-control)" strokeWidth="1" />
      {Array.from({ length: 10 }, (_, i) => {
        const angle = i / 10 * Math.PI * 2;
        return <circle key={i} cx={240 + 105 * Math.sin(angle)} cy={170 - 105 * Math.cos(angle)} r="4"
          fill="var(--color-paper)" stroke="var(--color-control)" />;
      })}
      <motion.g initial={false} animate={{ opacity: selected ? 1 : 0, scale: selected ? 1 : 0.9 }} style={{ transformOrigin: "240px 170px" }}
        transition={{ duration: reduce ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}>
        <circle cx="240" cy="170" r="31" fill="var(--color-paper)" stroke="var(--color-control)" />
        <path d="m226 170 10 10 19-22" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {!selected && <circle cx="240" cy="170" r="9" fill="var(--color-moss)" opacity=".35" />}
    </svg>
    <motion.div key={rotation} className="absolute inset-0" initial={reduce ? false : { rotate: -rotation, opacity: 0.65 }} animate={{ rotate: 0, opacity: selected ? 1 : 0.65 }}
      transition={{ duration: reduce ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}>
      <svg viewBox="0 0 480 340" className="h-full w-full"><g transform={`rotate(${rotation} 240 170)`}>
        <circle data-checkin-marker cx="240" cy="65" r="19" fill="var(--color-marker)" stroke="var(--color-ink)" strokeWidth="1.5" />
        <circle cx="248" cy="59" r="16" fill="var(--color-chart-band)" className="hidden [[data-theme=dark]_&]:block" />
      </g></svg>
    </motion.div>
  </figure>;
}
