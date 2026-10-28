// SAMPLE DATA. Not from the backend. Used until the FastAPI profile endpoints exist.

import type { ProfileSource } from "@/lib/data/profile";
import type { Profile } from "@/lib/types/api";

/** An example profile (values from TRD.md §12.1), shown where the UI needs one before onboarding. */
export const sampleProfile: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  age_range: "25-34",
  usual_sleep_hours: 7.5,
  usual_sleep_schedule: { bedtime: "23:30", wake_time: "07:30" },
  activity_level: "lightly_active",
  goals: ["better morning energy", "better focus"],
  regular_habits: ["Coffee around 9am", "Late dinner", "Phone in bed"],
  constraints: ["cannot exercise before work"],
  created_at: "2026-10-29T08:00:00.000Z",
  updated_at: "2026-10-29T08:00:00.000Z",
};

const STORAGE_KEY = "rhythm.mock.profile";
// Long enough to see loading states, short enough not to annoy.
const MOCK_LATENCY_MS = 400;

const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

function readStored(): Profile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

/** Stands in for GET/PUT /api/profile. Saves to this browser only; starts empty, like a new user. */
export const mockProfileSource: ProfileSource = {
  async getProfile() {
    await wait();
    return readStored();
  },

  async saveProfile(input) {
    await wait();
    const now = new Date().toISOString();
    const existing = readStored();
    const profile: Profile = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage blocked (private mode): the save still succeeds for this page view.
    }
    return profile;
  },
};
