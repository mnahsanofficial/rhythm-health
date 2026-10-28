// Preset habits offered in onboarding. The label is what gets stored in
// `profile.regular_habits`; the time only exists here, so the ring can place it.
// Custom habits the user types have no time and are listed, not placed.
// Habits describe routines, never amounts: no portions, calories or weights.

import { toMinutes } from "@/lib/rhythm/time";
import type { ClockTime, SleepSchedule } from "@/lib/types/api";

type HabitPreset =
  | { label: string; time: ClockTime }
  /** Placed relative to the user's own bedtime, so it never lands inside their night. */
  | { label: string; beforeBedMinutes: number };

export const HABIT_PRESETS: HabitPreset[] = [
  { label: "Morning workout", time: "07:00" },
  { label: "Coffee around 9am", time: "09:00" },
  { label: "Veg at lunch", time: "12:30" },
  { label: "Lunch at my desk", time: "13:00" },
  { label: "Coffee after 2pm", time: "14:30" },
  { label: "Afternoon nap", time: "15:30" },
  { label: "Evening workout", time: "18:30" },
  { label: "Walk after dinner", time: "20:00" },
  { label: "Late dinner", time: "21:30" },
  { label: "Phone in bed", beforeBedMinutes: 30 },
];

export type PlacedHabit = { label: string; time: ClockTime };

function minutesToClock(minutes: number): ClockTime {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The presets the user picked that can go on the ring, in order around the day. */
export function placeHabits(habits: string[], schedule?: SleepSchedule): PlacedHabit[] {
  return HABIT_PRESETS.filter((p) => habits.includes(p.label))
    .flatMap((p) => {
      if ("time" in p) return [{ label: p.label, time: p.time }];
      if (!schedule?.bedtime) return [];
      return [{ label: p.label, time: minutesToClock(toMinutes(schedule.bedtime) - p.beforeBedMinutes) }];
    })
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}
