"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatHours, minutesBetween, pointAt, toMinutes } from "@/lib/rhythm/time";
import type { PlacedHabit } from "@/lib/rhythm/habits";
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
const settle = { type: "spring", stiffness: 120, damping: 22 } as const;

type Props = {
  schedule?: SleepSchedule;
  sleepHours?: number;
  habits: PlacedHabit[];
};

/**
 * A person's day on a 24-hour dial: the night they sleep, and habits placed at their times.
 * It draws in when it first comes into view, then follows any change to the answers,
 * so during onboarding the ring visibly builds from what the user enters.
 */
export function RhythmRing({ schedule, sleepHours, habits }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();

  // Night arc = a circle stroke, rotated to bedtime, dashed to the length of the night.
  const startDeg = schedule ? (toMinutes(schedule.bedtime) / 1440) * 360 : 0;
  const spanFraction = schedule ? minutesBetween(schedule.bedtime, schedule.wake_time) / 1440 : 0;
  const rotate = useMotionValue(startDeg);
  const span = useMotionValue(0);
  const hours = useMotionValue(sleepHours ?? 0);
  const hoursText = useTransform(hours, (h) => formatHours(Math.round(h * 2) / 2));
  // Markers wait for the night arc on the first draw-in; after that, a newly picked habit pops in at once.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setSettled(true), 1600);
    return () => clearTimeout(t);
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    // Turn the short way round, so 23:30 → 00:30 moves forward an hour, not back 23.
    const delta = ((((startDeg - rotate.get()) % 360) + 540) % 360) - 180;
    if (reduce) {
      rotate.jump(rotate.get() + delta);
      span.jump(spanFraction);
      return;
    }
    const a = animate(rotate, rotate.get() + delta, settle);
    const b = animate(span, spanFraction, { duration: span.get() === 0 ? 1.1 : 0.5, ease: [0.22, 1, 0.36, 1] });
    return () => {
      a.stop();
      b.stop();
    };
  }, [inView, reduce, startDeg, spanFraction, rotate, span]);

  useEffect(() => {
    if (sleepHours === undefined) return;
    if (reduce) {
      hours.jump(sleepHours);
      return;
    }
    const a = animate(hours, sleepHours, { duration: 0.4, ease: "easeOut" });
    return () => a.stop();
  }, [sleepHours, reduce, hours]);

  const label = schedule
    ? `Sleep from ${schedule.bedtime} to ${schedule.wake_time}` +
      (sleepHours !== undefined ? `, about ${formatHours(sleepHours)} hours.` : ".") +
      (habits.length ? ` Habits: ${habits.map((h) => `${h.label} (${h.time})`).join(", ")}.` : "")
    : "Your rhythm will appear here as you answer.";

  return (
    <svg ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="h-auto w-full">
      <circle cx={C} cy={C} r={R_TRACK} fill="none" stroke="var(--color-line)" strokeWidth={22} />
      <Ticks />

      {schedule && <NightArc rotate={rotate} span={span} />}

      <AnimatePresence>
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
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.15 } }}
              transition={{ delay: settled ? 0 : 0.9 + i * 0.12, type: "spring", stiffness: 420, damping: 22 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
          );
        })}
      </AnimatePresence>

      {sleepHours !== undefined ? (
        <>
          <text x={C} y={C + 4} textAnchor="middle" className="fill-ink font-display text-[48px] tabular-nums">
            <motion.tspan>{hoursText}</motion.tspan>
            <tspan className="fill-muted font-sans text-[18px]"> h</tspan>
          </text>
          <text x={C} y={C + 30} textAnchor="middle" className="fill-muted font-sans text-[13px]">
            usual sleep
          </text>
        </>
      ) : (
        schedule && (
          <text x={C} y={C + 5} textAnchor="middle" className="fill-muted font-mono text-[13px] tabular-nums">
            {schedule.bedtime}–{schedule.wake_time}
          </text>
        )
      )}
    </svg>
  );
}

function NightArc({ rotate, span }: { rotate: MotionValue<number>; span: MotionValue<number> }) {
  // A circle's stroke starts at 3 o'clock; -90° puts the start of the dash at midnight.
  const fromTop = useTransform(rotate, (deg) => deg - 90);
  const dash = useTransform(span, (s) => `${s} ${1 - s}`);
  // A round cap on a zero-length dash still draws a dot, so hide the arc until it has length.
  const opacity = useTransform(span, (s) => (s > 0.002 ? 1 : 0));
  return (
    <motion.circle
      cx={C}
      cy={C}
      r={R_TRACK}
      fill="none"
      stroke="var(--color-night)"
      strokeWidth={22}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={dash}
      style={{ rotate: fromTop, opacity }}
    />
  );
}

function Ticks() {
  return (
    <>
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
    </>
  );
}
