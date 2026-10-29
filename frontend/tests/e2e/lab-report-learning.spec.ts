import { expect, test } from "@playwright/test";
import type { Experiment, Report } from "@/lib/types/api";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";
import { experiment } from "../support/fixtures";

type ProposedB2Report = Omit<Report, "interpretation" | "learnings" | "next_experiment"> & {
  summary: string;
  interpretation: string;
  personal_learnings: string[];
  confounders: string[];
  next_experiment: { question: string; reason: string };
};

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

const report: ProposedB2Report = {
  experiment_id: experiment.id,
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
    await expect(page.getByText(report.summary)).toBeVisible();
    await expect(page.getByText(report.personal_learnings[1])).toBeVisible();
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
