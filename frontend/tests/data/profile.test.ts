import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { getProfile, saveProfile } from "@/lib/data/profile";
import { server } from "../support/server";
import { profile, profileInput } from "../support/fixtures";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));

const api = "http://api.test.invalid";

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("profile data", () => {
  it("gets the signed-in user's profile with a bearer token", async () => {
    server.use(
      http.get(`${api}/api/profile`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        return HttpResponse.json(profile);
      }),
    );

    await expect(getProfile()).resolves.toEqual(profile);
  });

  it("returns null when the backend reports that no profile exists", async () => {
    server.use(http.get(`${api}/api/profile`, () => HttpResponse.json({ detail: "Profile not found" }, { status: 404 })));

    await expect(getProfile()).resolves.toBeNull();
  });

  it("saves a profile with PUT and the exact request body", async () => {
    server.use(
      http.put(`${api}/api/profile`, async ({ request }) => {
        expect(request.headers.get("content-type")).toContain("application/json");
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        expect(await request.json()).toEqual(profileInput);
        return HttpResponse.json(profile);
      }),
    );

    await expect(saveProfile(profileInput)).resolves.toEqual(profile);
  });

  it("preserves FastAPI validation errors for fields", async () => {
    server.use(
      http.put(`${api}/api/profile`, () =>
        HttpResponse.json({ detail: [{ field: "goals", message: "Add a goal" }] }, { status: 422 }),
      ),
    );

    await expect(saveProfile(profileInput)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "Some answers need another look.",
      fieldErrors: { goals: "Add a goal" },
    });
  });

  it("surfaces server failures and network failures as API errors", async () => {
    server.use(
      http.get(`${api}/api/profile`, () => HttpResponse.json({ detail: "Database unavailable" }, { status: 503 })),
    );
    await expect(getProfile()).rejects.toMatchObject({ status: 503, message: "Database unavailable" });

    server.use(http.get(`${api}/api/profile`, () => HttpResponse.error()));
    await expect(getProfile()).rejects.toMatchObject({ status: 0, name: "ApiError" });
  });

  it("does not send a request when the session has expired", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(getProfile()).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
