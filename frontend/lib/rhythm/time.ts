// Geometry for the 24-hour rhythm ring: midnight at the top, clockwise.

import type { ClockTime } from "@/lib/types/api";

const DAY_MINUTES = 24 * 60;

export function toMinutes(time: ClockTime): number {
  const [h, m] = time.split(":").map(Number);
  return ((h * 60 + m) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
}

/** Minutes from `from` forward to `to`, wrapping past midnight. */
export function minutesBetween(from: ClockTime, to: ClockTime): number {
  return (toMinutes(to) - toMinutes(from) + DAY_MINUTES) % DAY_MINUTES;
}

// Rounded so server and browser render identical SVG (Math.sin can differ in the last digit).
const round = (n: number) => Math.round(n * 100) / 100;

export function pointAt(minutes: number, cx: number, cy: number, r: number) {
  const a = (minutes / DAY_MINUTES) * 2 * Math.PI;
  return { x: round(cx + r * Math.sin(a)), y: round(cy - r * Math.cos(a)) };
}

/** 7.5 → "7.5", 8 → "8". */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** 465 → "7 h 45 min", 480 → "8 h". For durations people read, not compute with. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
