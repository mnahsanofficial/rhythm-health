import type { Profile } from '@rhythm-health/contract';
import { readConfig } from './config';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** The only product endpoint in step 1. It is read-only and cannot call AI. */
export async function getProfile(token: string): Promise<Profile | null> {
  let response: Response;
  try {
    response = await fetch(`${readConfig().apiUrl}/api/profile`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
    });
  } catch { throw new ApiError(0, "Couldn't reach the server. Check your connection and try again."); }
  if (response.status === 404) return null;
  if (response.status === 401) throw new ApiError(401, 'Your session has expired. Sign in again.');
  if (!response.ok) throw new ApiError(response.status, "Couldn't load your profile. Try again.");
  try { return await response.json() as Profile; }
  catch { throw new ApiError(502, "Couldn't read your profile. Try again."); }
}
