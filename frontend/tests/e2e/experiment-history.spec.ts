import { expect, test } from "@playwright/test";
import type { Experiment, LabReport } from "@/lib/types/api";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks, openSection } from "./helpers";
import { experiment, labReport } from "../support/fixtures";

const completedExperiment: Experiment = {
  ...experiment,
  status: "completed",
  completed_at: "2026-10-28T12:00:00Z",
  progress: {
    ...experiment.progress,
    state: "completed",
    day_number: null,
    phase: null,
    phase_day: null,
    phase_days: null,
    days_remaining: 0,
  },
};
const completedWithoutReport: Experiment = {
  ...completedExperiment,
  id: "44444444-4444-4444-8444-444444444444",
  question: "Does a quiet evening routine help me wind down?",
};

const report: LabReport = {
  experiment: completedExperiment,
  analysis: {
    personal_guess: null,
    primary_metric: "morning_energy",
    success_criteria_percent: 10,
    adherence: {
      baseline_days_planned: 3,
      baseline_days_logged: 3,
      intervention_days_planned: 7,
      intervention_days_logged: 7,
      intervention_days_completed: 6,
      adherence_rate: 6 / 7,
      coverage_rate: 1,
      missing_days: [],
    },
    metrics: [
      {
        key: "morning_energy",
        label: "Morning energy",
        type: "scale",
        primary: true,
        baseline: { n: 3, mean: 5.5, median: 5, sd: 1 },
        intervention: { n: 7, mean: 6.1, median: 6, sd: 1.2 },
        absolute_change: 0.6,
        percent_change: 11,
        median_change_percent: 10,
        pooled_sd: 1.14,
        effect_size: 0.53,
        direction_consistency: 0.71,
        outliers: [],
      },
    ],
    prediction: {
      predicted_direction: "increase",
      predicted_min: 8,
      predicted_max: 15,
      predicted_midpoint: 11.5,
      observed_change_percent: 11,
      error_points: -0.5,
      within_predicted_range: true,
      direction_correct: true,
      accuracy_percent: 100,
    },
    signal: {
      classification: "likely_signal",
      reasons: ["change_meets_success_criteria", "consistent_direction"],
      success_criteria_met: true,
      matches_predicted_direction: true,
    },
  },
  narrative: null,
  chart: labReport.chart,
  created_at: "2026-10-28T12:00:00Z",
};

const completedListRoute = new RegExp(`${API.replaceAll(".", "\\.")}/api/experiments(?:\\?.*)?$`);

async function openHistoryFromHome(page: import("@playwright/test").Page) {
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.goto("/");
  return counts;
}

for (const width of [390, 1440]) {
  test(`opens completed experiment history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHistoryFromHome(page);
    await page.route(completedListRoute, async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("status") === "completed") {
        await route.fulfill({ status: 200, json: [completedExperiment] });
        return;
      }
      await route.fallback();
    });
    await page.route(`${API}/api/experiments/${experiment.id}/report`, (route) =>
      route.fulfill({ status: 200, json: report }),
    );

    await openSection(page, "History");
    await expect(page).toHaveURL(/\/history$/);

    const item = page.getByRole("article", { name: experiment.question });
    await expect(item).toBeVisible();
    await expect(item).toContainText("October 28, 2026");
    await expect(item).toContainText("Morning energy +8–15%");
    await expect(item).toContainText("Morning energy +11%");
    await expect(item).toContainText("Likely signal");
    await expect(item.getByRole("link", { name: "Open Lab Report" })).toHaveAttribute(
      "href",
      `/experiments/${experiment.id}/report`,
    );
  });
}

test("shows a useful empty state when there are no completed experiments", async ({ page }) => {
  await openHistoryFromHome(page);
  await page.route(completedListRoute, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") === "completed") {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    await route.fallback();
  });

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Your experiment history" })).toBeVisible();
  await expect(page.getByText("Completed experiments will appear here.")).toBeVisible();
});

test("shows a retry when the completed-experiment list cannot be loaded", async ({ page }) => {
  await openHistoryFromHome(page);
  let attempts = 0;
  await page.route(completedListRoute, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") === "completed") {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, json: { detail: "History is unavailable" } });
      } else {
        await route.fulfill({ status: 200, json: [] });
      }
      return;
    }
    await route.fallback();
  });

  await page.goto("/history");
  const historyError = page.getByRole("alert").filter({ hasText: "History is unavailable" });
  await expect(historyError).toContainText("History is unavailable");
  await historyError.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Completed experiments will appear here.")).toBeVisible();
  expect(attempts).toBe(2);
});

test("shows report loading, missing, and retry states for individual history items", async ({ page }) => {
  await openHistoryFromHome(page);
  let releaseFirstReport!: () => void;
  let markFirstReportStarted!: () => void;
  let firstReportGateReleased = false;
  const firstReportGate = new Promise<void>((resolve) => {
    releaseFirstReport = resolve;
  });
  const firstReportStarted = new Promise<void>((resolve) => {
    markFirstReportStarted = resolve;
  });
  await page.route(completedListRoute, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") === "completed") {
      await route.fulfill({ status: 200, json: [completedExperiment, completedWithoutReport] });
      return;
    }
    await route.fallback();
  });
  await page.route(new RegExp(`${API.replaceAll(".", "\\.")}/api/experiments/[^/]+/report$`), async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    if (id === completedWithoutReport.id) {
      await route.fulfill({ status: 404, json: { detail: "No report for this experiment yet" } });
      return;
    }
    if (!firstReportGateReleased) {
      markFirstReportStarted();
      await firstReportGate;
      await route.fulfill({ status: 503, json: { detail: "Report service is unavailable" } });
      return;
    }
    await route.fulfill({ status: 200, json: report });
  });

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Your experiment history" })).toBeVisible();
  const readyReportItem = page.getByRole("article", { name: experiment.question });
  const missingReportItem = page.getByRole("article", { name: completedWithoutReport.question });
  await firstReportStarted;
  await expect(readyReportItem).toContainText("Loading report");
  firstReportGateReleased = true;
  releaseFirstReport();
  await expect(readyReportItem).toContainText("Couldn't load this report");
  await expect(missingReportItem).toContainText("Report not available yet");
  await readyReportItem.getByRole("button", { name: "Try again" }).click();
  await expect(readyReportItem).toContainText("Morning energy +11%");
});

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`orders completed experiments at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const counts = await openHistoryFromHome(page);
      await page.emulateMedia({ reducedMotion });
      const older: Experiment = {
        ...completedWithoutReport, completed_at: "2026-10-20T12:00:00Z", is_seeded: true,
      };
      await page.route(completedListRoute, async route => {
        if (new URL(route.request().url()).searchParams.get("status") === "completed") {
          await route.fulfill({ json: [older, completedExperiment] });
        } else await route.fallback();
      });
      await page.route(`${API}/api/experiments/${experiment.id}/report`, route => route.fulfill({ json: report }));
      await page.route(`${API}/api/experiments/${older.id}/report`, route => route.fulfill({ status: 404, json: { detail: "Not ready" } }));
      await page.goto("/history");
      const articles = page.getByRole("article");
      await expect(articles.first()).toHaveAccessibleName(completedExperiment.question);
      await expect(page.getByText("Sample experiment", { exact: true })).toBeVisible();
      const capture = async (frame: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: `../docs/screenshots/ui-motion/history/${width}/${frame}.png`, fullPage: true });
      };
      await expect(articles.first()).toContainText("Morning energy +11%");
      await capture("before");
      const oldest = page.getByRole("radio", { name: "Oldest first" });
      await oldest.focus();
      await page.keyboard.press("Space");
      await expect(articles.first()).toHaveAccessibleName(older.question);
      await capture("during");
      await expect(page.getByRole("status").filter({ hasText: "2 completed experiments" })).toContainText("oldest first");
      await expect.poll(() => page.getByRole("list", { name: "Completed experiments" }).evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      await expect.poll(() => page.getByRole("list", { name: "Completed experiments" }).getByRole("listitem").evaluateAll(items => items.every(item => {
        const transform = getComputedStyle(item).transform;
        const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
        return Math.abs(matrix.m41) < 0.01 && Math.abs(matrix.m42) < 0.01;
      }))).toBe(true);
      await capture("after");
      await expect(oldest).toBeFocused();
      await page.getByText("Newest first", { exact: true }).click();
      await expect(articles.first()).toHaveAccessibleName(completedExperiment.question);
      expect(counts.proposals).toBe(0);
    });
  }
}
