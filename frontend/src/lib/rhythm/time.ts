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

/** SVG path for the clockwise arc from `from` to `to`. */
export function arcPath(from: ClockTime, to: ClockTime, cx: number, cy: number, r: number): string {
  const start = pointAt(toMinutes(from), cx, cy, r);
  const end = pointAt(toMinutes(to), cx, cy, r);
  const largeArc = minutesBetween(from, to) > DAY_MINUTES / 2 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** 7.5 → "7.5", 8 → "8". */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
