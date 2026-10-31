import type { Profile } from '@rhythm-health/contract';
import { ApiError, apiGet } from './api';
export { ApiError } from './api';

export async function getProfile(token: string): Promise<Profile | null> {
  try { return await apiGet<Profile>(token, '/api/profile', "Couldn't load your profile. Try again."); }
  catch (cause) { if (cause instanceof ApiError && cause.status === 404) return null; throw cause; }
}
