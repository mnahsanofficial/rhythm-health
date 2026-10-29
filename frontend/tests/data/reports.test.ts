import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeExperiment, getReport, writeReport } from "@/lib/data/reports";
import { completedExperiment, labReport, writtenLabReport } from "../support/fixtures";
import { server } from "../support/server";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));

const api = "http://api.test.invalid";
const id = completedExperiment.id;

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("report data", () => {
  it("reads the Lab Report, with the experiment embedded and no narrative yet", async () => {
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(labReport)));
    const report = await getReport(id);
    expect(report?.experiment.id).toBe(id);
    expect(report?.narrative).toBeNull();
    expect(report?.chart.points).toHaveLength(10);
  });

  it("answers null when the experiment has no report yet", async () => {
    server.use(http.get(`${api}/api/experiments/${id}/report`, () =>
      HttpResponse.json({ detail: "No report for this experiment yet" }, { status: 404 })));
    await expect(getReport(id)).resolves.toBeNull();
  });

  it("returns the Lab Report from completing an experiment", async () => {
    server.use(http.post(`${api}/api/experiments/${id}/complete`, () => HttpResponse.json(labReport)));
    await expect(completeExperiment(id)).resolves.toEqual(labReport);
  });

  it("writes the narrative with one POST /report and never asks to regenerate", async () => {
    const calls: string[] = [];
    server.use(http.post(`${api}/api/experiments/${id}/report`, ({ request }) => {
      calls.push(request.url);
      expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
      return HttpResponse.json(writtenLabReport);
    }));
    const report = await writeReport(id);
    expect(report.narrative?.next_experiment.question).toMatch(/walking earlier/);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]).searchParams.has("regenerate")).toBe(false);
  });

  it.each([
    [503, "AI service unavailable, please try again"],
    [502, "Could not write the report, please try again"],
    [409, "Complete the experiment before writing its report"],
  ])("keeps the status and message of a %i from POST /report", async (status, detail) => {
    server.use(http.post(`${api}/api/experiments/${id}/report`, () => HttpResponse.json({ detail }, { status })));
    await expect(writeReport(id)).rejects.toMatchObject({ name: "ApiError", status, message: detail });
  });
});
