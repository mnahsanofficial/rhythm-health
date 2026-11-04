"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

export const STEP_NAMES = ["Age", "Sleep", "Hours", "Move", "Goals", "Habits", "Limits"];

/** Where you are in setup. Each part of your rhythm has a name, so the end is never a surprise. */
export function StepRail({ current }: { current: number }) {
  const reduce = useReducedMotion();
  const total = STEP_NAMES.length;
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`Question ${current} of ${total}`}
        className="flex gap-1.5"
      >
        {STEP_NAMES.map((name, i) => (
          <div key={name} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
            <motion.div
              className="h-full origin-left rounded-pill bg-accent"
              initial={false}
              animate={{ scaleX: i < current ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
            />
          </div>
        ))}
      </div>
      <ol aria-label="Setup steps" className="mt-2 hidden gap-1.5 text-caption sm:flex">
        {STEP_NAMES.map((name, i) => (
          <li
            key={name}
            aria-current={i + 1 === current ? "step" : undefined}
            className={`flex-1 ${i + 1 === current ? "font-medium text-ink" : "text-muted"}`}
          >
            {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
