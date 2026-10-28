"use client";

import { motion } from "motion/react";

/** One segment per question. The current segment fills with a spring as you arrive on it. */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Question ${current} of ${total}`}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
          <motion.div
            className="h-full origin-left rounded-pill bg-moss"
            initial={false}
            animate={{ scaleX: i < current ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>
      ))}
    </div>
  );
}
