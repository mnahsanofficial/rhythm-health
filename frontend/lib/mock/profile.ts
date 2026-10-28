// SAMPLE DATA. Not from the backend.
// Only used to illustrate the home page ring, where it is labelled as sample data.

import type { Profile } from "@/lib/types/api";

/** An example profile (values from TRD.md §12.1). */
export const sampleProfile: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  age_range: "25-34",
  usual_sleep_hours: 7.5,
  usual_sleep_schedule: { bedtime: "23:30", wake_time: "07:30" },
  activity_level: "lightly_active",
  goals: ["More energy in the morning", "Better focus"],
  regular_habits: ["Coffee around 9am", "Late dinner", "Phone in bed"],
  constraints: ["Can't exercise before work"],
  created_at: "2026-10-29T08:00:00.000Z",
  updated_at: "2026-10-29T08:00:00.000Z",
};
