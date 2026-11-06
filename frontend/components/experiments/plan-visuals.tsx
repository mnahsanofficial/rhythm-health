"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { signedPercent } from "@/lib/report/copy";

/** A plan illustration, never a claim about recorded days or request completion. */
export function PlanRing({ normal, test, pending = false }: { normal: number; test: number; pending?: boolean }) {
  const reduce = useReducedMotion();
  const total = normal + test;
  return <div aria-hidden="true" className="relative flex min-h-52 items-center justify-center overflow-hidden rounded-card bg-chart-band/50 sm:min-h-72 lg:min-h-96">
    <svg viewBox="0 0 480 340" className="h-52 w-full sm:h-72 lg:h-96">
      <ellipse cx="90" cy="360" rx="310" ry="120" fill="var(--color-chart-2)" opacity=".12" />
      <ellipse cx="440" cy="390" rx="310" ry="140" fill="var(--color-chart-1)" opacity=".1" />
      <circle cx="240" cy="170" r="105" fill="none" stroke="var(--color-control)" />
      {Array.from({ length: total }, (_, i) => {
        const angle = i / total * Math.PI * 2;
        return <motion.circle key={i} cx={240 + 105 * Math.sin(angle)} cy={170 - 105 * Math.cos(angle)} r="8"
          fill={`var(--color-chart-${i < normal ? 1 : 2})`} stroke="var(--color-paper)" strokeWidth="2"
          initial={reduce || !pending ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : MOTION_DURATION.response, delay: pending && !reduce ? i * MOTION_DURATION.reveal : 0 }} />;
      })}
      <motion.g initial={reduce || !pending ? false : { y: 35, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal, ease: MOTION_EASE.settle }}>
        <circle cx="240" cy="170" r="28" fill="var(--color-marker)" stroke="var(--color-ink)" />
        <circle cx="252" cy="160" r="24" fill="var(--color-chart-band)" className="hidden [[data-theme=dark]_&]:block" />
      </motion.g>
    </svg>
  </div>;
}

export function GuessBar({ value }: { value: number | null }) {
  return <div aria-hidden="true" className="mt-6">
    <div className="relative h-3 rounded-pill bg-line">
      <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${100 / 3}%` }} />
      {value !== null && <span className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-pill border-2 border-ink bg-marker" style={{ left: `${(value + 100) / 3}%` }} />}
    </div>
    <div className="mt-4 flex justify-between font-mono text-caption"><span>-100%</span><span>+200%</span></div>
  </div>;
}

/** One coordinate system keeps a guess outside the predicted range visible without clipping it. */
export function PlanRange({ min, max, guess }: { min: number; max: number; guess: number | null }) {
  const extent = Math.max(Math.abs(min), Math.abs(max), Math.abs(guess ?? 0), 1) * 1.2;
  const position = (value: number) => (value + extent) / (extent * 2) * 100;
  return <figure aria-label={`Predicted range ${signedPercent(min, 2)} to ${signedPercent(max, 2)}${guess === null ? "" : `; your guess ${signedPercent(guess, 2)}`}`} className="mt-8">
    <div aria-hidden="true" className="relative h-4 rounded-pill bg-line">
      <span className="absolute inset-y-0 w-px bg-ink" style={{ left: "50%" }} />
      <span className="absolute inset-y-0 rounded-pill bg-night-text" style={{ left: `${position(Math.min(min, max))}%`, width: `${Math.max((Math.abs(max - min) / (extent * 2)) * 100, 1)}%` }} />
      {guess !== null && <span className="absolute -top-2 size-8 -translate-x-1/2 rounded-pill border-2 border-ink bg-marker" style={{ left: `${position(guess)}%` }} />}
    </div>
    <div aria-hidden="true" className="mt-5 flex justify-between font-mono text-caption"><span>{signedPercent(-extent, 0)}</span><span>0%</span><span>{signedPercent(extent, 0)}</span></div>
    <figcaption className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-body"><span className="flex items-center gap-2"><span className="h-2 w-6 rounded-pill bg-night-text" />Predicted range</span>{guess !== null && <span className="flex items-center gap-2"><span className="size-3 rounded-pill border border-ink bg-marker" />Your guess</span>}</figcaption>
  </figure>;
}
