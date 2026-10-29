import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { resetDemo } from "@/lib/data/demo";
import type { Report } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { server } from "../support/server";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));

const api = "http://api.test.invalid";
const report: Report = {
  experiment_id: experiment.id,
  analysis: {
    primary_metric: "morning_energy",
    success_criteria_percent: 10,
    adherence: {
      baseline_days_planned: 3,
      baseline_days_logged: 3,
      intervention_days_planned: 7,
      intervention_days_logged: 7,
      intervention_days_completed: 7,
      adherence_rate: 1,
      coverage_rate: 1,
      missing_days: [],
    },
    metrics: [],
    prediction: null,
    signal: {
      classification: "likely_signal",
      reasons: ["change_meets_success_criteria"],
      success_criteria_met: true,
      matches_predicted_direction: true,
    },
  },
  interpretation: null,
  learnings: null,
  next_experiment: null,
  created_at: "2026-10-28T12:00:00Z",
};
const response = { experiment: { ...experiment, status: "completed" as const, is_seeded: true }, report };

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("demo data", () => {
  it("posts an authenticated empty reset request and returns the seeded report", async () => {
    server.use(
      http.post(`${api}/api/demo/reset`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        expect(request.headers.get("content-type")).toBe("application/json");
        expect(await request.json()).toEqual({});
        return HttpResponse.json(response);
      }),
    );

    await expect(resetDemo()).resolves.toEqual(response);
  });

  it.each([404, 409, 503])("preserves demo reset failure status %i", async (status) => {
    server.use(
      http.post(`${api}/api/demo/reset`, () =>
        HttpResponse.json({ detail: "Demo reset is unavailable" }, { status }),
      ),
    );

    await expect(resetDemo()).rejects.toMatchObject({
      name: "ApiError",
      status,
      message: "Demo reset is unavailable",
    });
  });

  it("keeps network and expired-session failures distinct", async () => {
    server.use(http.post(`${api}/api/demo/reset`, () => HttpResponse.error()));
    await expect(resetDemo()).rejects.toBeInstanceOf(ApiError);
    await expect(resetDemo()).rejects.toMatchObject({ status: 0 });

    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockClear();
    await expect(resetDemo()).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
