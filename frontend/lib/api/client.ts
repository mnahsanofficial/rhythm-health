import { supabase } from "@/lib/auth/supabase";

// Trailing slashes are trimmed so `${API_URL}${path}` never produces `//` (FastAPI 404s on it).
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/+$/, "");

/** A failed API call. `status` is 0 when the server couldn't be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** FastAPI sends `{detail: string}`, or `{detail: [{msg}]}` for validation errors. */
function detailOf(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return `Request failed (${status})`;
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
  if (!res.ok) throw new ApiError(res.status, detailOf(body, res.status));
  return body as T;
}

export function apiGet<T>(path: string, auth = false): Promise<T> {
  return request<T>("GET", path, { auth });
}

/** POST or PUT with a JSON body. Authenticated by default: every write needs a user. */
export function apiSend<T>(method: "POST" | "PUT", path: string, body?: unknown, auth = true): Promise<T> {
  return request<T>(method, path, { auth, body });
}
