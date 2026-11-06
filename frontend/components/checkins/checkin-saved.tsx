"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./checkin-chrome";
import { button } from "@/components/ui/button";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { getExperimentProgress } from "@/lib/data/experiments";
import { ApiError } from "@/lib/api/client";
import type { ExperimentTimeline } from "@/lib/types/api";

export type SavedDay = { id: string; day: number; total: number; name: string; sample?: boolean };
/** The same neutral celebration for every answer. Only refreshed server progress supplies the count. */
export function CheckinSaved({ items, onEdit }: { items: SavedDay[]; onEdit: () => void }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [timeline, setTimeline] = useState<ExperimentTimeline | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const first = items[0];
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    getExperimentProgress(first.id).then(result => { if (active) { setTimeline(result); setError(false); } }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace("/sign-in?next=/");
      else setError(true);
    });
    return () => { active = false; };
  }, [first.id, attempt, router]);
  const total = timeline?.progress.total_days;
  const share = timeline && total ? Math.min(timeline.recorded_days / total, 1) : null;
  const left = timeline?.progress.days_remaining;
  return <Shell wide>
    <section className="grid min-h-[calc(100svh-var(--header-h)-8rem)] content-center items-center gap-8 py-6 lg:grid-cols-2 lg:gap-16" aria-label="Check-in recorded">
      <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-96">
        <svg viewBox="0 0 300 300" className="h-auto w-full">
          <circle cx="150" cy="150" r="112" fill="none" stroke="var(--color-line)" strokeWidth="12" />
          {share !== null && <>
            <motion.circle cx="150" cy="150" r="112" fill="none" stroke="var(--color-moss)" strokeWidth="12" pathLength="1"
              strokeDasharray={`${share} ${1 - share}`} strokeLinecap="round" transform="rotate(-90 150 150)"
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal }} />
          </>}
          <path d="m130 150 14 14 28-30" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {share !== null && <motion.div key={share} className="absolute inset-0" initial={reduce ? false : { rotate: -share * 360 }} animate={{ rotate: 0 }}
          transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal, ease: MOTION_EASE.settle }}>
          <svg viewBox="0 0 300 300" className="h-full w-full"><g transform={`rotate(${share * 360} 150 150)`}>
            <circle data-celebration-marker cx="150" cy="38" r="18" fill="var(--color-marker)" stroke="var(--color-ink)" strokeWidth="1.5" />
            <circle cx="157" cy="32" r="15" fill="var(--color-oat)" className="hidden [[data-theme=dark]_&]:block" />
          </g></svg>
        </motion.div>}
      </div>
      <div>
        {items.some(item => item.sample) && <p className="mb-3 text-caption">Sample experiment · Sample check-in</p>}
        <h1 ref={heading} tabIndex={-1} className="font-display text-display-sm tracking-tight outline-none">{items.length === 1 ? `Day ${first.day} recorded.` : `${items.length} check-ins recorded.`}</h1>
        {items.length > 1 && <ul className="mt-4 space-y-2">{items.map(item => <li key={item.id}><span className="font-medium">{item.name}</span> · Day {item.day} of {item.total}</li>)}</ul>}
        {timeline && left !== null && left !== undefined && <p role="status" className="mt-4 text-lead">{items.length > 1 ? `${first.name}: ` : ""}{left === 0 ? "That was the last day." : `${left} ${left === 1 ? "day" : "days"} left`}</p>}
        {error && <div role="alert" className="mt-5 text-body"><p>Your check-in is saved. Progress couldn&apos;t refresh.</p><button type="button" className={`${button("secondary")} mt-3`} onClick={() => { setError(false); setAttempt(n => n + 1); }}>Refresh progress</button></div>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className={button("primary")}>Continue <span className="ml-3" aria-hidden="true">→</span></Link>
          <button type="button" onClick={onEdit} className={button("secondary")}>Change today&apos;s answers</button>
        </div>
      </div>
    </section>
  </Shell>;
}
