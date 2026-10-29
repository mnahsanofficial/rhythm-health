import { expect, test } from "@playwright/test";
import type { Checkin, Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`personal dashboard at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      await page.emulateMedia({ reducedMotion });
      const active: Experiment = {
        ...experiment, status: "active", started_at: "2026-10-25T10:00:00Z",
        progress: {
          state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1,
          phase_days: 7, total_days: 10, days_remaining: 6,
          started_at: "2026-10-25T10:00:00Z", ends_at: "2026-11-04T10:00:00Z",
        },
      };
      const recorded: Checkin = {
        id: "test-record", experiment_id: experiment.id, phase: "baseline", day_number: 1,
        intervention_completed: false, metric_values: { morning_energy: 6, sleep_quality: 7 },
        note: "A quiet evening.", created_at: "2026-10-25T12:00:00Z", updated_at: "2026-10-25T12:00:00Z",
      };
      let doneToday = false;
      await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
      await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({
        json: doneToday ? [recorded, { ...recorded, id: "today", day_number: 4, phase: "intervention" }] : [recorded],
      }));
      await page.goto("/");
      await expect(page.getByRole("heading", { name: experiment.question })).toBeVisible();
      await expect(page.getByText("Day 4 of 10", { exact: true })).toBeVisible();
      await expect(page.getByText(/sample data|Questions people test|Stop guessing/)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Test a new question" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Check in for day 4" })).toHaveAttribute("href", `/experiments/${experiment.id}/check-in`);
      await expect(page.getByText("1 of 10 days recorded", { exact: true })).toBeVisible();

      const capture = async (phase: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: `../docs/screenshots/ui-motion/dashboard/${width}/${phase}.png`, fullPage: true });
      };
      await capture("before");
      await page.getByRole("button", { name: "Day 1, baseline, logged" }).click();
      const details = page.getByRole("region", { name: "Recorded day" });
      await expect(details).toContainText("A quiet evening.");
      await capture("during");
      await expect(details.getByRole("article")).toHaveCSS("opacity", "1");
      await capture("after");
      await expect(page.getByRole("button", { name: "Day 1, baseline, logged" })).toHaveAttribute("aria-expanded", "true");
      if (reducedMotion === "reduce") {
        expect(await details.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      }
      doneToday = true;
      await page.reload();
      await expect(page.getByText("Done for today", { exact: true })).toBeVisible();
      await expect(page.getByText("2 of 10 days recorded", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Change today's answers" })).toHaveAttribute("href", `/experiments/${experiment.id}/check-in`);
      await expect(page.getByText("Change made on 0 of 1 test days", { exact: true })).toBeVisible();
      await capture("done-today");
      expect(counts.proposals).toBe(0);
    });
  }
}
