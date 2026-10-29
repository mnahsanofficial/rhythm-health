import { supabase } from "@/lib/auth/supabase";

// Trailing slashes are trimmed so `${API_URL}${path}` never produces `//` (FastAPI 404s on it).
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/+$/, "");

/** A failed API call. `status` is 0 when the server couldn't be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Per-field messages, keyed by field name, when the backend names the fields at fault. */
    readonly fieldErrors: Record<string, string> = {},
    /** The backend's `detail` as sent, for errors that carry data (e.g. check-in counts). */
    readonly detail: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The backend's `detail` comes in four shapes:
 * a string; FastAPI validation `[{msg, loc}]`; check-in validation `[{field, message}]`;
 * or an object with a `message` plus data (e.g. "not enough check-ins" with counts).
 */
function parseDetail(body: unknown, status: number): { message: string; fieldErrors: Record<string, string> } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const fieldErrors: Record<string, string> = {};
  if (typeof detail === "string") return { message: detail, fieldErrors };
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (typeof item?.field === "string" && typeof item?.message === "string") fieldErrors[item.field] = item.message;
    }
    if (Object.keys(fieldErrors).length > 0) return { message: "Some answers need another look.", fieldErrors };
    if (typeof detail[0]?.msg === "string") return { message: detail[0].msg, fieldErrors };
  }
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return { message: (detail as { message: string }).message, fieldErrors };
  }
  return { message: `Request failed (${status})`, fieldErrors };
}

async function request<T>(method: string, path: string, opts: { auth: boolean; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new ApiError(401, "You're signed out. Sign in and try again.");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const { message, fieldErrors } = parseDetail(body, res.status);
    throw new ApiError(res.status, message, fieldErrors, (body as { detail?: unknown } | null)?.detail ?? null);
  }
  return body as T;
}

export function apiGet<T>(path: string, auth = false): Promise<T> {
  return request<T>("GET", path, { auth });
}

/** POST or PUT with a JSON body. Authenticated by default: every write needs a user. */
export function apiSend<T>(method: "POST" | "PUT", path: string, body?: unknown, auth = true): Promise<T> {
  return request<T>(method, path, { auth, body });
}
