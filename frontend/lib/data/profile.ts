// Profile data for the UI. Screens import from here, never from lib/mock directly.
//
// Wiring the real API: write a source that calls GET/PUT
// `${NEXT_PUBLIC_API_URL}/api/profile` with the Supabase bearer token,
// and assign it to `profileSource` below. Nothing else should need to change.

import { mockProfileSource, sampleProfile } from "@/lib/mock/profile";
import type { Profile, ProfileInput } from "@/lib/types/api";

export type ProfileSource = {
  /** Resolves to null when the user hasn't created a profile yet. */
  getProfile(): Promise<Profile | null>;
  saveProfile(input: ProfileInput): Promise<Profile>;
};

export const profileSource: ProfileSource = mockProfileSource;

/** True while screens show sample data; use it to label them. */
export const isSampleData = true;

/** Always sample data, even once the API is wired: used to illustrate the product before a user has a profile. */
export const exampleProfile = sampleProfile;
