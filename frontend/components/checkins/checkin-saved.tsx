"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { primaryButton, secondaryButton, Shell } from "@/components/checkins/checkin-chrome";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import type { Checkin, Experiment } from "@/lib/types/api";

/** The confirmation after a save: which day was recorded, and how far along the experiment is. */
export function CheckinSaved({ experiment, checkins, day, experimentPath, onEdit }: {
  experiment: Experiment;
  checkins: Checkin[];
  day: number;
  experimentPath: string;
  onEdit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { progress } = experiment;
  const logged = new Set(checkins.map((c) => c.day_number));

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Shell>
      <div role="status" className="flex flex-col items-start">
        <Tick reduceMotion={Boolean(reduceMotion)} />
        {experiment.is_seeded && <p className="mt-3 font-medium text-moss">Sample experiment · Sample check-in</p>}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-5 font-display text-display-sm tracking-tight outline-none"
        >
          Day {day} recorded.
        </h1>
        <p className="mt-3 text-lead text-muted">
          {logged.size} of {progress.total_days} days logged.{" "}
          {progress.days_remaining ? `${progress.days_remaining} to go.` : "That was the last day."}
        </p>
        <ol aria-label="Days logged" className="mt-6 flex flex-wrap gap-1.5">
          {Array.from({ length: progress.total_days }, (_, i) => {
            const n = i + 1;
            const isLogged = logged.has(n);
            return (
              <motion.li
                key={n}
                aria-label={`Day ${n}${isLogged ? ", logged" : ""}`}
                initial={n === day && !reduceMotion ? { scale: 0.7, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
                className={`grid size-11 place-items-center rounded-pill border font-mono text-caption ${
                  isLogged ? "border-moss bg-moss text-on-accent" : n <= day ? "border-line bg-paper" : "border-dashed border-line"
                }`}
              >
                <span aria-hidden="true">{isLogged ? "✓" : n}</span>
              </motion.li>
            );
          })}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={experimentPath} className={primaryButton}>
            Go to your experiment
          </Link>
          <button type="button" onClick={onEdit} className={secondaryButton}>
            Change today&apos;s answers
          </button>
        </div>
      </div>
    </Shell>
  );
}

/** A single settling tick confirms the successful save. */
function Tick({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="size-20"
      aria-hidden="true"
      initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
    >
      <circle cx="24" cy="24" r="22" fill="var(--color-moss-tint)" />
      <path
        d="M14 24.5 L21 31.5 L34 17"
        fill="none"
        stroke="var(--color-moss)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}
