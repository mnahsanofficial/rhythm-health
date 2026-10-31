import { readConfig } from './config';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly fields: Record<string, string> = {}) { super(message); }
}
const member = (value: unknown, key: string): unknown => value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;

async function request<T>(token: string, path: string, failure: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${readConfig().apiUrl}${path}`, body === undefined ? {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
    } : {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch { throw new ApiError(0, "Couldn't reach the server. Check your connection and try again."); }
  if (response.status === 401) throw new ApiError(401, 'Your session has expired. Sign in again.');
  if (!response.ok) {
    let detail: unknown;
    try { detail = member(await response.json(), 'detail'); } catch { /* A proxy may return no JSON body. */ }
    const fields: Record<string, string> = {};
    if (Array.isArray(detail)) for (const item of detail) {
      const location = member(item, 'loc');
      const field = member(item, 'field') ?? (Array.isArray(location) ? location.at(-1) : undefined);
      const message = member(item, 'message') ?? member(item, 'msg');
      if (typeof field === 'string' && typeof message === 'string') fields[field] = message;
    }
    throw new ApiError(response.status, typeof detail === 'string' ? detail : failure, fields);
  }
  try { return await response.json() as T; }
  catch { throw new ApiError(502, failure); }
}
export const apiGet = <T>(token: string, path: string, failure: string) => request<T>(token, path, failure);
export const apiPost = <T>(token: string, path: string, body: unknown, failure: string) => request<T>(token, path, failure, body);
