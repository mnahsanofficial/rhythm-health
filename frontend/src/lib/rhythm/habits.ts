// Preset habits offered in onboarding. The label is what gets stored in
// `profile.regular_habits`; the time only exists here, so the ring can place it.
// Custom habits the user types have no time and are listed, not placed.

import type { ClockTime } from "@/lib/types/api";

export type HabitPreset = { label: string; time: ClockTime };

export const HABIT_PRESETS: HabitPreset[] = [
  { label: "Coffee around 9am", time: "09:00" },
  { label: "Late dinner", time: "21:30" },
  { label: "Phone in bed", time: "23:00" },
];

/** The presets the user picked, in time order around the day. */
export function placeHabits(habits: string[]): HabitPreset[] {
  return HABIT_PRESETS.filter((preset) => habits.includes(preset.label));
}
