import { expect, test } from "@playwright/test";
import type { Experiment, LabReport } from "@/lib/types/api";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks, openSection } from "./helpers";
import { experiment, labReport } from "../support/fixtures";

const question = "Does walking after dinner improve morning energy?";
const demoExperiment: Experiment = {
  ...experiment,
  question,
  status: "completed",
  is_seeded: true,
  started_at: "2026-10-18T12:00:00Z",
  completed_at: "2026-10-28T12:00:00Z",
  progress: {
    ...experiment.progress,
    state: "completed",
    day_number: null,
    phase: null,
    phase_day: null,
    phase_days: null,
    total_days: 10,
    days_remaining: 0,
    started_at: "2026-10-18T12:00:00Z",
    ends_at: "2026-10-28T12:00:00Z",
  },
};

const demoReport: LabReport = {
  experiment: demoExperiment,
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
  narrative: null,
  chart: labReport.chart,
  created_at: "2026-10-28T12:00:00Z",
};

async function prepareSignedInHome(page: import("@playwright/test").Page) {
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.goto("/");
  await openSection(page, "Demo");
}

function mockDemoReset(page: import("@playwright/test").Page, status = 200) {
  return page.route(`${API}/api/demo/reset`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["authorization"]).toBe("Bearer fake-e2e-access-token");
    expect(route.request().postDataJSON()).toEqual({});
    if (status !== 200) {
      await route.fulfill({ status, json: { detail: "Demo reset is unavailable" } });
      return;
    }
    await route.fulfill({ status: 200, json: demoReport });
  });
}

async function mockReportReads(page: import("@playwright/test").Page) {
  await page.route(`${API}/api/experiments/${experiment.id}`, (route) =>
    route.fulfill({ status: 200, json: demoExperiment }),
  );
  await page.route(`${API}/api/experiments/${experiment.id}/report`, (route) =>
    route.fulfill({ status: 200, json: demoReport }),
  );
  await page.route(`${API}/api/experiments/${experiment.id}/checkins`, (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
}

for (const width of [390, 1440]) {
  test(`opens the seeded completed report at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepareSignedInHome(page);
    await mockDemoReset(page);
    await mockReportReads(page);

    const demoButton = page.getByRole("button", { name: "Explore a completed example" });
    await expect(demoButton).toBeVisible();
    await page.screenshot({ path: `test-results/seeded-demo-entry-${width}.png`, fullPage: true });
    await demoButton.click();

    await expect(page).toHaveURL(`/experiments/${experiment.id}/report`);
    await expect(page.getByRole("heading", { name: question })).toBeVisible();
    await expect(page.getByRole("note", { name: "Sample experiment" })).toBeVisible();
    await expect(page.getByText("Likely signal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How the days went" })).toBeVisible();
    await page.screenshot({ path: `test-results/seeded-demo-report-${width}.png`, fullPage: true });
  });
}

test("shows loading and retry states when preparing the demo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await prepareSignedInHome(page);
  await mockReportReads(page);
  let releaseReset!: () => void;
  let markResetStarted!: () => void;
  const resetGate = new Promise<void>((resolve) => { releaseReset = resolve; });
  const resetStarted = new Promise<void>((resolve) => { markResetStarted = resolve; });
  let attempts = 0;

  await page.route(`${API}/api/demo/reset`, async (route) => {
    attempts += 1;
    expect(route.request().headers()["authorization"]).toBe("Bearer fake-e2e-access-token");
    expect(route.request().postDataJSON()).toEqual({});
    if (attempts === 1) {
      markResetStarted();
      await resetGate;
      await route.fulfill({ status: 503, json: { detail: "Demo reset is unavailable" } });
      return;
    }
    await route.fulfill({ status: 200, json: demoReport });
  });

  const button = page.getByRole("button", { name: /Explore a completed example|Preparing the demo/ });
  await button.click();
  await resetStarted;
  await expect(button).toBeDisabled();
  await expect(button).toContainText("Preparing the demo");
  releaseReset();

  const demoError = page.getByRole("alert").filter({ hasText: "Couldn't prepare the demo" });
  await expect(demoError).toContainText("Demo reset is unavailable");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(`/experiments/${experiment.id}/report`);
  expect(attempts).toBe(2);
});
