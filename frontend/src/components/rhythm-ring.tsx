"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { arcPath, formatHours, pointAt, toMinutes } from "@/lib/rhythm/time";
import type { HabitPreset } from "@/lib/rhythm/habits";
import type { SleepSchedule } from "@/lib/types/api";

const SIZE = 320;
const C = SIZE / 2;
const R_TRACK = 116;
const R_MARKERS = 142;
const HOUR_LABELS = [
  { minutes: 0, text: "00" },
  { minutes: 360, text: "06" },
  { minutes: 720, text: "12" },
  { minutes: 1080, text: "18" },
];

const nightVariants: Variants = {
  hidden: { pathLength: 0 },
  shown: { pathLength: 1, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] } },
};

const markerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  shown: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: 0.9 + i * 0.12, type: "spring", stiffness: 420, damping: 22 },
  }),
};

type Props = {
  schedule: SleepSchedule;
  sleepHours: number;
  habits: HabitPreset[];
  /** Draw the ring in when it first scrolls into view. */
  drawIn?: boolean;
};

/** A person's day on a 24-hour dial: the night they sleep, and the habits placed at their times. */
export function RhythmRing({ schedule, sleepHours, habits, drawIn = true }: Props) {
  const reduce = useReducedMotion();
  const animate = drawIn && !reduce;
  const night = arcPath(schedule.bedtime, schedule.wake_time, C, C, R_TRACK);
  const label =
    `Sleep from ${schedule.bedtime} to ${schedule.wake_time}, about ${formatHours(sleepHours)} hours.` +
    (habits.length ? ` Habits: ${habits.map((h) => `${h.label} (${h.time})`).join(", ")}.` : "");

  return (
    <motion.svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className="h-auto w-full"
      initial={animate ? "hidden" : "shown"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.5 }}
    >
      <circle cx={C} cy={C} r={R_TRACK} fill="none" stroke="var(--color-line)" strokeWidth={22} />

      {Array.from({ length: 24 }, (_, hour) => {
        const major = hour % 6 === 0;
        const inner = pointAt(hour * 60, C, C, R_TRACK - 15);
        const outer = pointAt(hour * 60, C, C, R_TRACK - (major ? 24 : 20));
        return (
          <line
            key={hour}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-muted)"
            strokeOpacity={major ? 0.7 : 0.3}
            strokeWidth={1.25}
          />
        );
      })}

      {HOUR_LABELS.map(({ minutes, text }) => {
        const p = pointAt(minutes, C, C, R_TRACK - 42);
        return (
          <text
            key={text}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted font-mono text-[11px]"
          >
            {text}
          </text>
        );
      })}

      <motion.path
        d={night}
        fill="none"
        stroke="var(--color-night)"
        strokeWidth={22}
        strokeLinecap="round"
        variants={nightVariants}
      />

      {habits.map((habit, i) => {
        const p = pointAt(toMinutes(habit.time), C, C, R_MARKERS);
        return (
          <motion.circle
            key={habit.label}
            cx={p.x}
            cy={p.y}
            r={7}
            fill="var(--color-sun)"
            stroke="var(--color-ink)"
            strokeWidth={1.5}
            custom={i}
            variants={markerVariants}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          />
        );
      })}

      <text x={C} y={C + 4} textAnchor="middle" className="fill-ink font-display text-[48px] tabular-nums">
        {formatHours(sleepHours)}
        <tspan className="fill-muted font-sans text-[18px]"> h</tspan>
      </text>
      <text x={C} y={C + 30} textAnchor="middle" className="fill-muted font-sans text-[13px]">
        usual sleep
      </text>
    </motion.svg>
  );
}
