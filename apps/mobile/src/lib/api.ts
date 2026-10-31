import { readConfig } from './config';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly fields: Record<string, string> = {}) { super(message); }
}

export async function apiGet<T>(token: string, path: string, failure: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${readConfig().apiUrl}${path}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
    });
  } catch { throw new ApiError(0, "Couldn't reach the server. Check your connection and try again."); }
  if (response.status === 401) throw new ApiError(401, 'Your session has expired. Sign in again.');
  if (!response.ok) throw new ApiError(response.status, failure);
  try { return await response.json() as T; }
  catch { throw new ApiError(502, failure); }
}
