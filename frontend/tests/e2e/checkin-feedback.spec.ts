import { expect, test } from "@playwright/test";
import type { Checkin, Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`check-in feedback at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      const active: Experiment = {
        ...experiment, status: "active", started_at: "2026-10-25T10:00:00Z",
        progress: {
          state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1,
          phase_days: 7, total_days: 10, days_remaining: 6,
          started_at: "2026-10-25T10:00:00Z", ends_at: "2026-11-04T10:00:00Z",
        },
      };
      await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
      let attempts = 0;
      await page.route(`${API}/api/experiments/${experiment.id}/checkins`, async route => {
        if (route.request().method() === "GET") return route.fulfill({ json: [] });
        attempts += 1;
        if (attempts === 1) return route.fulfill({ status: 503, json: { detail: "Please try saving again" } });
        const saved: Checkin = {
          ...route.request().postDataJSON(), id: "checkin-test", experiment_id: experiment.id,
          phase: "intervention", day_number: 4,
          created_at: "2026-10-29T10:00:00Z", updated_at: "2026-10-29T10:00:00Z",
        };
        await route.fulfill({ json: saved });
      });
      await page.goto(`/experiments/${experiment.id}/check-in`);
      const capture = async (name: string, phase: "before" | "during" | "after") => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        if (phase === "after") {
          if (name === "answers") {
            await expect.poll(() => page.getByRole("progressbar").evaluate(el => {
              const fill = el.firstElementChild!;
              return Math.round(fill.getBoundingClientRect().width / el.getBoundingClientRect().width * 100);
            })).toBe(100);
          } else {
            await expect(page.getByRole("main").locator("svg")).toHaveCSS("opacity", "1");
          }
        }
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: `../docs/screenshots/ui-motion/check-in/${width}/${name}-${phase}.png`, fullPage: true });
      };
      const progress = page.getByRole("progressbar", { name: "Check-in answers" });
      await expect(progress).toHaveAttribute("aria-valuenow", "0");
      await capture("answers", "before");
      await page.getByText("Not today", { exact: true }).click();
      await capture("answers", "during");
      await page.getByRole("group", { name: "Morning energy" }).getByText("7", { exact: true }).click();
      await page.getByRole("group", { name: "Sleep quality" }).getByText("6", { exact: true }).click();
      await expect(progress).toHaveAttribute("aria-valuenow", "3");
      await capture("answers", "after");
      await expect(page.getByRole("status").filter({ hasText: "3 of 3 answered" })).toBeVisible();
      await page.getByRole("button", { name: "Save today's check-in" }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Please try saving again");
      await expect(page.getByRole("radio", { name: "Not today", exact: true })).toBeChecked();
      await capture("saved", "before");
      await page.getByRole("button", { name: "Save today's check-in" }).click();
      await expect(page.getByRole("heading", { name: "Day 4 recorded." })).toBeFocused();
      await capture("saved", "during");
      await capture("saved", "after");
      await expect(page.getByRole("listitem", { name: "Day 4, logged" })).toBeVisible();
      await expect(page.getByRole("status")).toContainText("1 of 10 days logged");
      if (reducedMotion === "reduce") {
        const animations = await page.locator("main").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length);
        expect(animations).toBe(0);
      }
      await page.getByRole("button", { name: "Change today's answers" }).click();
      await expect(progress).toHaveAttribute("aria-valuenow", "3");
      expect(attempts).toBe(2);
    });
  }
}
