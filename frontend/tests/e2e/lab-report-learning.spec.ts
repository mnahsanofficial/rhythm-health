import { expect, test } from "@playwright/test";
import type { Checkin, Experiment, LabReport } from "@/lib/types/api";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";
import { experiment, labReport } from "../support/fixtures";

const nextQuestion = "Keep the evening walk, but move it closer to dinner?";
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

const report: LabReport = {
  experiment: completedExperiment,
  analysis: {
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
    prediction: null,
    signal: {
      classification: "likely_signal",
      reasons: ["change_meets_success_criteria"],
      success_criteria_met: true,
      matches_predicted_direction: true,
    },
  },
  narrative: {
    summary: "Your morning energy was higher during the test days.",
    interpretation: "Evening movement appears to support your next-morning energy.",
    personal_learnings: [
      "Evening movement appears to be positively associated with your next-morning energy.",
      "Bedtime consistency may matter more than walk duration.",
    ],
    confounders: ["Bedtime varied during the experiment."],
    next_experiment: {
      question: nextQuestion,
      reason: "The next test can narrow down when the walk works best.",
    },
  },
  chart: labReport.chart,
  created_at: "2026-10-28T12:00:00Z",
};

for (const width of [390, 1440]) {
  test(`shows report takeaways and a follow-up experiment at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);

    await page.route(`${API}/api/experiments/${experiment.id}`, (route) =>
      route.fulfill({ status: 200, json: completedExperiment }),
    );
    await page.route(`${API}/api/experiments/${experiment.id}/report`, (route) =>
      route.fulfill({ status: 200, json: report }),
    );
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, (route) =>
      route.fulfill({ status: 200, json: [] }),
    );

    await page.goto(`/experiments/${experiment.id}/report`);
    await expect(page.getByRole("heading", { name: "What you learned about you" })).toBeVisible();
    await expect(page.getByText(report.narrative!.summary)).toBeVisible();
    await expect(page.getByText(report.narrative!.personal_learnings[1])).toBeVisible();
    await expect(page.getByRole("heading", { name: "What to test next" })).toBeVisible();
    await expect(page.getByText(nextQuestion)).toBeVisible();
    const runNextExperiment = page.getByRole("link", { name: "Run this experiment" });
    await expect(runNextExperiment).toHaveAttribute(
      "href",
      `/experiments/new?question=${encodeURIComponent(nextQuestion)}`,
    );

    await page.screenshot({ path: `test-results/lab-report-learning-${width}.png`, fullPage: true });
    await runNextExperiment.click();
    await expect(page.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(nextQuestion);
  });
}

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`reveals prediction versus reality at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      await page.emulateMedia({ reducedMotion });
      const calculatedReport = {
        ...report,
        narrative: null,
        analysis: { ...report.analysis, prediction: {
          predicted_direction: "increase", predicted_min: 8, predicted_max: 15, predicted_midpoint: 11.5,
          observed_change_percent: 11, error_points: -0.5, within_predicted_range: true,
          direction_correct: true, accuracy_percent: 100,
        } },
      };
      await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: completedExperiment }));
      await page.route(`${API}/api/experiments/${experiment.id}/report`, route => route.fulfill({ json: calculatedReport }));
      const checkins: Checkin[] = Array.from({ length: 10 }, (_, index) => ({
        id: `record-${index + 1}`, experiment_id: experiment.id,
        phase: index < 3 ? "baseline" : "intervention", day_number: index + 1,
        intervention_completed: index >= 3 && index < 9,
        metric_values: { morning_energy: index < 3 ? [5, 5.5, 6][index] : 6.1, sleep_quality: 7 },
        note: null, created_at: "2026-10-28T12:00:00Z", updated_at: "2026-10-28T12:00:00Z",
      }));
      await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: checkins }));
      await page.goto(`/experiments/${experiment.id}/report`);
      const comparison = page.getByRole("region", { name: "Prediction vs reality" });
      const capture = async (frame: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (frame === "after") {
          const chart = page.getByRole("region", { name: "Day by day" });
          await chart.scrollIntoViewIfNeeded();
          await expect.poll(() => chart.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
          await comparison.scrollIntoViewIfNeeded();
        }
        await page.screenshot({ path: `../docs/screenshots/ui-motion/report/${width}/${frame}.png`, fullPage: true });
      };
      await expect(comparison).toBeVisible();
      const verdict = page.getByRole("region", { name: "Likely signal" });
      const comparisonTop = await comparison.evaluate(el => el.getBoundingClientRect().top);
      expect(comparisonTop).toBeLessThan(await verdict.evaluate(el => el.getBoundingClientRect().top));
      await capture("before");
      const reveal = comparison.getByRole("button", { name: "Reveal my result" });
      await reveal.focus();
      await page.keyboard.press("Enter");
      await expect(comparison.getByRole("status")).toContainText("inside the predicted range");
      await capture("during");
      await expect(comparison.getByText("+11%", { exact: true })).toHaveCSS("opacity", "1");
      await capture("after");
      await expect(comparison.getByText("+8% to +15%", { exact: true })).toBeVisible();
      await expect(comparison.getByRole("button", { name: "Replay comparison" })).toBeFocused();
      if (reducedMotion === "reduce") {
        expect(await comparison.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      }
      // Before the narrative is written, the report offers to write it rather than waiting.
      await expect(page.getByRole("region", { name: "What you learned about you" }).getByRole("button", { name: "Write my report" })).toBeEnabled();
      await expect(page.getByRole("region", { name: "What to test next" })).toContainText("appears once your report is written");
      await expect(page.getByRole("link", { name: "Run this experiment" })).toHaveCount(0);
      expect(counts.proposals).toBe(0);
    });
  }
}
