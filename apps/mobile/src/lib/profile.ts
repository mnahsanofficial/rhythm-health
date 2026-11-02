import type { Profile, ProfileInput } from '@rhythm-health/contract';
import { ApiError, apiGet, apiPut } from './api';
export { ApiError } from './api';

export async function getProfile(token: string): Promise<Profile | null> {
  try { return await apiGet<Profile>(token, '/api/profile', "Couldn't load your profile. Try again."); }
  catch (cause) { if (cause instanceof ApiError && cause.status === 404) return null; throw cause; }
}

export function saveProfile(token: string, input: ProfileInput): Promise<Profile> {
  return apiPut<Profile>(token, '/api/profile', input, "Couldn't save your rhythm.");
}
