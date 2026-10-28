// Profile data for the UI. Screens import from here, never from lib/mock or the API client directly.

import { apiGet, apiSend, ApiError } from "@/lib/api/client";
import { sampleProfile } from "@/lib/mock/profile";
import type { Profile, ProfileInput } from "@/lib/types/api";

/** The signed-in user's profile, or null if they haven't created one (the API answers 404). */
export async function getProfile(): Promise<Profile | null> {
  try {
    return await apiGet<Profile>("/api/profile", true);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Create or replace the signed-in user's profile (PUT /api/profile). */
export function saveProfile(input: ProfileInput): Promise<Profile> {
  return apiSend<Profile>("PUT", "/api/profile", input);
}

/** Always sample data: illustrates the product on the home page before anyone has a profile. */
export const exampleProfile = sampleProfile;
