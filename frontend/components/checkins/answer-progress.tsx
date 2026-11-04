"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

/** How many of today's questions are answered, updated as the person goes. */
export function AnswerProgress({ answered, total }: { answered: number; total: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="mt-6 border-y border-line py-4">
      <div className="flex items-center justify-between gap-4 text-caption">
        <p role="status" className="font-mono tabular-nums">
          {answered} of {total} answered
        </p>
        <span className="text-muted">{answered === total ? "Ready to record" : "Note optional"}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Check-in answers"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        className="mt-3 h-1 overflow-hidden rounded-pill bg-line"
      >
        <motion.div
          initial={false}
          animate={{ scaleX: total ? answered / total : 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
          className="h-full origin-left bg-moss"
        />
      </div>
    </div>
  );
}
