"use client";

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

type Props = {
  schedule?: SleepSchedule;
  sleepHours?: number;
  habits: PlacedHabit[];
};

/**
 * A person's day on a 24-hour dial: the night they sleep, and habits placed at their times.
 * The completed arc and new habit markers arrive once using transform and opacity.
 * Geometry is final immediately; CSS media queries keep hydration independent of motion preferences.
 */
export function RhythmRing({ schedule, sleepHours, habits }: Props) {
  const startDeg = schedule ? (toMinutes(schedule.bedtime) / 1440) * 360 : 0;
  const spanFraction = schedule ? minutesBetween(schedule.bedtime, schedule.wake_time) / 1440 : 0;

  const label = schedule
    ? `Sleep from ${schedule.bedtime} to ${schedule.wake_time}` +
      (sleepHours !== undefined ? `, about ${formatHours(sleepHours)} hours.` : ".") +
      (habits.length ? ` Habits: ${habits.map((h) => `${h.label} (${h.time})`).join(", ")}.` : "")
    : "Your rhythm will appear here as you answer.";

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="h-auto w-full">
      <circle cx={C} cy={C} r={R_TRACK} fill="none" stroke="var(--color-line)" strokeWidth={22} />
      <Ticks />

      {schedule && <NightArc rotate={startDeg} span={spanFraction} />}

      <g>
        {habits.map((habit) => {
          const p = pointAt(toMinutes(habit.time), C, C, R_MARKERS);
          return (
            <circle
              key={habit.label}
              cx={p.x}
              cy={p.y}
              r={7}
              fill="var(--color-sun)"
              stroke="var(--color-ink)"
              strokeWidth={1.5}
              className="origin-center motion-safe:animate-[rhythm-arrive_var(--motion-response)_var(--ease-settle)_both]"
              style={{ transformBox: "fill-box" }}
            />
          );
        })}
      </g>

      {sleepHours !== undefined ? (
        <>
          <text x={C} y={C + 4} textAnchor="middle" className="fill-ink font-display text-[48px] tabular-nums">
            <tspan>{formatHours(sleepHours)}</tspan>
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

function NightArc({ rotate, span }: { rotate: number; span: number }) {
  return (
    <g className="origin-center motion-safe:animate-[rhythm-arrive_var(--motion-reveal)_var(--ease-settle)_both]">
      <circle
        cx={C} cy={C} r={R_TRACK}
        fill="none" stroke="var(--color-night)" strokeWidth={22}
        strokeLinecap="round" pathLength={1}
        strokeDasharray={`${span} ${1 - span}`}
        transform={`rotate(${rotate - 90} ${C} ${C})`}
        opacity={span > 0.002 ? 1 : 0}
      />
    </g>
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
