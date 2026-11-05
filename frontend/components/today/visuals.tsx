"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { dayLabel, experimentName, weeklyCount, type RunningExperiment } from "./model";

/** Fixed geometry, revealed through opacity only. The words always carry the final count. */
export function WeeklyRing({ entry }: { entry: RunningExperiment }) {
  const reduce = useReducedMotion();
  const count = weeklyCount(entry);
  const name = experimentName(entry);
  return <svg viewBox="0 0 120 120" className="size-28 shrink-0" role="img"
    aria-label={count === null ? `${name}: weekly check-ins unavailable` : `${name}: ${count} of 7 days recorded in the last seven experiment days`}>
    {Array.from({ length: 7 }, (_, index) => <g key={index} transform={`rotate(${index * 360 / 7 - 90} 60 60)`}>
      <circle cx="60" cy="60" r="47" fill="none" stroke="var(--color-line)" strokeWidth="7" pathLength="7" strokeDasharray="0.82 6.18" strokeLinecap="round" />
      <motion.circle cx="60" cy="60" r="47" fill="none" stroke="var(--color-moss)" strokeWidth="7" pathLength="7" strokeDasharray="0.82 6.18" strokeLinecap="round"
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: index < (count ?? 0) ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : MOTION_DURATION.response, delay: reduce ? 0 : index * MOTION_DURATION.press / 7 }} />
    </g>)}
    <text x="60" y="65" textAnchor="middle" className="fill-ink font-display text-[29px]">{count ?? "—"}<tspan className="font-sans text-[15px]">/7</tspan></text>
  </svg>;
}

export function DayStrip({ entry }: { entry: RunningExperiment }) {
  return <ol aria-label={`${experimentName(entry)}: ${entry.timeline.progress.total_days}-day timeline`} className="flex gap-1.5">
    {entry.timeline.days.map(day => {
      const state = day.state === "recorded" ? "logged" : day.state === "current" ? "today, not logged yet"
        : day.state === "missed" ? "missed" : day.state === "not_observed" ? "not recorded before completion" : "upcoming";
      return <li key={day.day_number} aria-label={`Day ${day.day_number}, ${day.phase === "baseline" ? "baseline" : "test"}, ${state}`}
        className={`grid h-7 min-w-0 flex-1 place-items-center rounded-control border font-mono text-[11px] ${
          day.state === "recorded" ? day.phase === "baseline" ? "border-night bg-night text-on-accent" : "border-moss bg-moss text-on-accent"
            : day.state === "missed" ? "border-dashed border-control text-ink"
              : day.state === "current" ? "border-ink bg-paper text-ink ring-1 ring-ink" : "border-transparent bg-line/50 text-ink"}`}>
        <span aria-hidden="true">{day.state === "recorded" ? "✓" : day.state === "missed" ? "–" : day.day_number}</span>
      </li>;
    })}
  </ol>;
}

/** A ten-day scene from server states; decorative, with a still sun or moon in the current position. */
export function TodayScene({ entry }: { entry: RunningExperiment }) {
  const reduce = useReducedMotion();
  const { progress } = entry.timeline;
  const angle = ((progress.day_number ?? 1) - 1) / progress.total_days * Math.PI * 2;
  const x = 180 + Math.sin(angle) * 66, y = 100 - Math.cos(angle) * 66;
  return <div className="flex items-center overflow-hidden bg-chart-band/50" aria-hidden="true">
    <svg viewBox="80 0 200 200" className="h-36 w-full sm:h-full sm:min-h-48" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="20" cy="232" rx="230" ry="105" fill="var(--color-moss)" opacity=".08" />
      <ellipse cx="350" cy="236" rx="240" ry="100" fill="var(--color-night)" opacity=".07" />
      <circle cx="180" cy="100" r="66" fill="none" stroke="var(--color-control)" strokeWidth="1" />
      {entry.timeline.days.map(day => {
        const a = (day.day_number - 1) / progress.total_days * Math.PI * 2;
        const px = 180 + Math.sin(a) * 66, py = 100 - Math.cos(a) * 66;
        return <g key={day.day_number}>
          <circle cx={px} cy={py} r="5" fill={day.state === "recorded" ? "var(--color-moss)" : "var(--color-paper)"} stroke="var(--color-ink)" />
          {day.state === "missed" && <path d={`M${px - 2} ${py}h4`} stroke="var(--color-ink)" />}
        </g>;
      })}
      <text x="180" y="98" textAnchor="middle" className="fill-ink font-display text-[24px]">{progress.day_number !== null ? `Day ${progress.day_number}` : dayLabel(entry)}</text>
      <text x="180" y="118" textAnchor="middle" className="fill-ink font-sans text-[11px]">{progress.phase === "baseline" ? "Your normal days" : progress.phase === "intervention" ? "Your test days" : "Your experiment"}</text>
      <motion.g initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : MOTION_DURATION.reveal, ease: MOTION_EASE.settle }}>
        <circle cx={x} cy={y} r="12" fill="var(--color-marker)" stroke="var(--color-ink)" strokeWidth="1.5" />
        <circle cx={x + 5} cy={y - 4} r="10" fill="var(--color-chart-band)" className="hidden [[data-theme=dark]_&]:block" />
      </motion.g>
    </svg>
  </div>;
}
