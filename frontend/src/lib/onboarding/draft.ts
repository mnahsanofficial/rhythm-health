// Onboarding answers before sign-up. Kept in this browser until the account is
// created, then sent once as PUT /api/profile (see lib/data/profile.ts).

import type { ProfileInput } from "@/lib/types/api";

export type OnboardingDraft = Partial<ProfileInput>;

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
