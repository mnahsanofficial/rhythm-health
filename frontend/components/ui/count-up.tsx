"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

/**
 * A real count arriving. Only for counts, such as days recorded: never for predictions, results or
 * other health estimates, which appear at their final value. Rendered at its final value first, so
 * the server's HTML and reduced motion are both simply correct.
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const target = node.current;
    if (!target || reduce || value === 0) return;
    const controls = animate(0, value, {
      duration: MOTION_DURATION.response,
      ease: MOTION_EASE.settle,
      onUpdate: latest => { target.textContent = `${Math.round(latest)}${suffix}`; },
      onComplete: () => { target.textContent = `${value}${suffix}`; },
    });
    return () => {
      controls.stop();
      target.textContent = `${value}${suffix}`;
    };
  }, [value, suffix, reduce]);
  return <span ref={node}>{`${value}${suffix}`}</span>;
}
