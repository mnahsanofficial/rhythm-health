// Types for the FastAPI backend, matching TRD.md (§12 database model, §27 API surface).
// Field names stay snake_case so responses can be used without mapping.

// The TRD only gives "25-34" as an example. Proposed list; confirm with backend.
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

// The TRD only gives "lightly_active" as an example. Proposed list; confirm with backend.
export const ACTIVITY_LEVELS = [
  "mostly_sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** 24-hour local time, "HH:MM". */
export type ClockTime = string;

export type SleepSchedule = {
  bedtime: ClockTime;
  wake_time: ClockTime;
};

/** GET /api/profile (TRD §12.1). `user_id` is never sent to or needed by the frontend. */
export type Profile = {
  id: string;
  age_range: AgeRange;
  usual_sleep_hours: number;
  usual_sleep_schedule: SleepSchedule;
  activity_level: ActivityLevel;
  goals: string[];
  regular_habits: string[];
  constraints: string[];
  created_at: string;
  updated_at: string;
};

/** PUT /api/profile body. No `user_id`: the backend derives it from the token (TRD §6, §7). */
export type ProfileInput = Omit<Profile, "id" | "created_at" | "updated_at">;
