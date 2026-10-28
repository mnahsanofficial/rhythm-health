// Onboarding answers before sign-up. Kept in this browser until the account is
// created, then sent once as PUT /api/profile (see lib/data/profile.ts).

import type { ProfileInput } from "@/lib/types/api";

export type OnboardingDraft = Partial<ProfileInput>;

/** The full PUT /api/profile body, or null while any required answer is missing. */
export function toProfileInput(d: OnboardingDraft): ProfileInput | null {
  const s = d.usual_sleep_schedule;
  if (!d.age_range || !s?.bedtime || !s.wake_time || d.usual_sleep_hours === undefined || !d.activity_level) {
    return null;
  }
  if (!d.goals?.length) return null;
  return {
    age_range: d.age_range,
    usual_sleep_hours: d.usual_sleep_hours,
    usual_sleep_schedule: { bedtime: s.bedtime, wake_time: s.wake_time },
    activity_level: d.activity_level,
    goals: d.goals,
    regular_habits: d.regular_habits ?? [],
    constraints: d.constraints ?? [],
  };
}

type Stored = { step: number; draft: OnboardingDraft };

const KEY = "rhythm.onboarding.draft";

export function loadDraft(): Stored {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return { step: 0, draft: {} };
}

export function saveDraft(stored: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage blocked: answers still live in memory for this visit.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
