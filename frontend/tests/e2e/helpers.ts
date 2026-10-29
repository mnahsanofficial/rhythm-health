import type { Page } from "@playwright/test";
import type { Experiment, Profile, ProposeResponse } from "@/lib/types/api";
import { experiment, proposeResponse } from "../support/fixtures";

export const API = "http://api.test.invalid";
const SUPABASE_AUTH = "https://supabase.test.invalid/auth/v1";

export type E2eCounts = { signUps: number; profileWrites: number; proposals: number; saves: number; starts: number };

export async function installApiMocks(page: Page) {
  const counts: E2eCounts = { signUps: 0, profileWrites: 0, proposals: 0, saves: 0, starts: 0 };
  let savedProfile: Profile | null = null;
  let savedExperiment: Experiment | null = null;
  let activeExperiment: Experiment | null = null;

  await page.route(`${SUPABASE_AUTH}/signup`, async (route) => {
    counts.signUps += 1;
    const email = route.request().postDataJSON().email as string;
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: "2026-10-29T10:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: "2026-10-29T10:00:00Z",
      updated_at: "2026-10-29T10:00:00Z",
    };
    await route.fulfill({
      status: 200,
      json: {
        access_token: "fake-e2e-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fake-e2e-refresh-token",
        user,
        weak_password: null,
      },
    });
  });
  await page.route(`${SUPABASE_AUTH}/logout**`, (route) => route.fulfill({ status: 204, body: "" }));

  await page.route(`${API}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/profile" && method === "PUT") {
      counts.profileWrites += 1;
      const input = request.postDataJSON();
      savedProfile = {
        ...input,
        id: "22222222-2222-4222-8222-222222222222",
        created_at: "2026-10-29T10:00:00Z",
        updated_at: "2026-10-29T10:00:00Z",
      };
      await route.fulfill({ status: 200, json: savedProfile });
      return;
    }

    if (url.pathname === "/api/profile" && method === "GET") {
      await route.fulfill(savedProfile ? { status: 200, json: savedProfile } : { status: 404, json: { detail: "Profile not found" } });
      return;
    }

    if (url.pathname === "/api/experiments/propose" && method === "POST") {
      counts.proposals += 1;
      const { question } = request.postDataJSON() as { question: string };
      const response: ProposeResponse = {
        ...proposeResponse,
        proposal: { ...proposeResponse.proposal!, question },
      };
      await route.fulfill({ status: 200, json: response });
      return;
    }

    if (url.pathname === "/api/experiments" && method === "GET") {
      await route.fulfill({ status: 200, json: url.searchParams.get("status") === "active" && activeExperiment ? [activeExperiment] : [] });
      return;
    }

    if (url.pathname === "/api/experiments" && method === "POST") {
      counts.saves += 1;
      const body = request.postDataJSON();
      savedExperiment = {
        ...experiment,
        ...body.proposal,
        id: experiment.id,
        status: "proposed",
        category: body.category,
        prediction: body.prediction,
      };
      await route.fulfill({ status: 201, json: savedExperiment });
      return;
    }

    const experimentMatch = url.pathname.match(/^\/api\/experiments\/([^/]+)$/);
    if (experimentMatch && method === "GET") {
      await route.fulfill(activeExperiment ? { status: 200, json: activeExperiment } : { status: 404, json: { detail: "Not found" } });
      return;
    }

    if (url.pathname.endsWith("/checkins") && method === "GET") {
      await route.fulfill({ status: 200, json: [] });
      return;
    }

    const startMatch = url.pathname.match(/^\/api\/experiments\/([^/]+)\/start$/);
    if (startMatch && method === "POST") {
      counts.starts += 1;
      const source = savedExperiment ?? experiment;
      activeExperiment = {
        ...source,
        status: "active",
        started_at: "2026-10-29T10:00:00Z",
        progress: {
          state: "in_progress",
          day_number: 1,
          phase: "baseline",
          phase_day: 1,
          phase_days: source.baseline_days,
          total_days: source.baseline_days + source.intervention_days,
          days_remaining: source.baseline_days + source.intervention_days - 1,
          started_at: "2026-10-29T10:00:00Z",
          ends_at: "2026-11-08T10:00:00Z",
        },
      };
      await route.fulfill({ status: 200, json: activeExperiment });
      return;
    }

    await route.fulfill({ status: 404, json: { detail: `No test handler for ${method} ${url.pathname}` } });
  });

  return counts;
}

export async function answerOnboardingWithMouse(page: Page) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("heading", { name: "How old are you?" }).waitFor();
  await page.getByText("25–34", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "When do you usually sleep?" }).waitFor();
  await page.getByLabel("Bedtime").fill("22:30");
  await page.getByLabel("Wake time").fill("06:30");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "How much of that is actual sleep?" }).waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "How much do you move on a typical day?" }).waitFor();
  await page.getByText(/Lightly active/).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What would you like to improve?" }).waitFor();
  await page.getByText("More energy in the morning", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What do you already do most days?" }).waitFor();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("heading", { name: "Anything that limits what you can change?" }).waitFor();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("heading", { name: /Here's your rhythm/ }).waitFor();
}

export async function createAccountAndSaveProfile(page: Page, counts: E2eCounts) {
  await page.getByRole("textbox", { name: "Email" }).fill("learner@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("fake-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  if (counts.signUps !== 1 || counts.profileWrites !== 1) {
    throw new Error(`Expected one mocked sign-up and profile save; got ${counts.signUps} and ${counts.profileWrites}`);
  }
}
