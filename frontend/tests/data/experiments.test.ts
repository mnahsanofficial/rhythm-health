import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  getExperiment,
  listExperiments,
  proposeExperiment,
  saveExperiment,
  startExperiment,
} from "@/lib/data/experiments";
import { server } from "../support/server";
import {
  experiment,
  proposeResponse,
  saveExperimentRequest,
} from "../support/fixtures";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));

const api = "http://api.test.invalid";

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("experiment data", () => {
  it("posts a question to the propose endpoint and returns the typed response", async () => {
    server.use(
      http.post(`${api}/api/experiments/propose`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        expect(await request.json()).toEqual({ question: "Does a short evening walk help my morning energy?" });
        return HttpResponse.json(proposeResponse);
      }),
    );

    await expect(proposeExperiment("Does a short evening walk help my morning energy?")).resolves.toEqual(proposeResponse);
  });

  it.each([422, 502, 503])("preserves proposal failure status %i", async (status) => {
    server.use(http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ detail: "Try again later" }, { status })));

    await expect(proposeExperiment("Does a short walk help my energy?")).rejects.toMatchObject({
      name: "ApiError",
      status,
      message: "Try again later",
    });
  });

  it("saves the proposal and prediction in the backend request shape", async () => {
    server.use(
      http.post(`${api}/api/experiments`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        expect(await request.json()).toEqual(saveExperimentRequest);
        return HttpResponse.json(experiment, { status: 201 });
      }),
    );

    await expect(saveExperiment(saveExperimentRequest)).resolves.toEqual(experiment);
  });

  it("starts a saved experiment with POST and no body", async () => {
    server.use(
      http.post(`${api}/api/experiments/${experiment.id}/start`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        expect(request.headers.get("content-type")).toBeNull();
        expect(await request.text()).toBe("");
        return HttpResponse.json({ ...experiment, status: "active" });
      }),
    );

    await expect(startExperiment(experiment.id)).resolves.toMatchObject({ status: "active" });
  });

  it("gets an experiment by its encoded id", async () => {
    server.use(
      http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(experiment)),
    );

    await expect(getExperiment(experiment.id)).resolves.toEqual(experiment);
  });

  it("lists experiments with and without a status filter", async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${api}/api/experiments`, ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json([experiment]);
      }),
    );

    await expect(listExperiments("active")).resolves.toEqual([experiment]);
    await expect(listExperiments()).resolves.toEqual([experiment]);
    expect(requests).toEqual(["?status=active", ""]);
  });

  it("keeps authentication, server, and network failures distinct", async () => {
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json({ detail: "You're signed out" }, { status: 401 })),
    );
    await expect(listExperiments()).rejects.toMatchObject({ status: 401, message: "You're signed out" });

    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.error()));
    await expect(listExperiments()).rejects.toBeInstanceOf(ApiError);
    await expect(listExperiments()).rejects.toMatchObject({ status: 0 });
  });

  it("fails locally without fetching when there is no active session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(listExperiments()).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
