"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION } from "@/lib/motion";
import { PlanRing } from "./plan-visuals";

const steps = ["Checking it’s a safe, small change", "Designing your experiment", "Forecasting what might happen"];
/** One pending request; these activities never pretend to be completed stages. */
export function ProposalSkeleton() {
  const reduce = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section aria-label="Preparing your experiment" className="mx-auto max-w-[70rem]">
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div>
        <h1 ref={heading} tabIndex={-1} className="font-display text-headline tracking-tight sm:text-display-sm">Planning your experiment.</h1>
        <p className="mt-4 text-lead">One small change, a plan for your days, and an honest forecast.</p>
        <ul aria-label="What goes into your experiment" className="mt-7 space-y-5">{steps.map(text => <li key={text} className="flex items-start gap-3">
          <motion.span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-pill bg-moss" initial={false} animate={{ opacity: reduce ? 1 : [1, 0.3, 1] }} transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal * 2, repeat: reduce ? 0 : Infinity }} />
          <span>{text}<span className="sr-only">, in progress</span></span>
        </li>)}</ul>
        <p role="status" className="mt-7 text-caption">Usually 10–30 seconds. Your plan and forecast arrive together.</p>
      </div>
      <PlanRing normal={3} test={7} pending />
    </div>
  </section>;
}
