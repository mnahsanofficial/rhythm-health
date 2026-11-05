import { expect, test } from "@playwright/test";
import type { Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1024, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Today hierarchy, details and recovery at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      const active: Experiment = { ...experiment, status: "active", progress: {
        ...experiment.progress, state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
      } };
      let recorded = false;
      let unavailable = false;
      await page.route(`${API}/api/experiments?status=active`, route => route.fulfill(unavailable
        ? { status: 503, json: { detail: "Temporarily unavailable" } } : { json: [active] }));
      await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({ json:
        timelineFixture(active, { recorded: recorded ? [1, 3, 4] : [1, 3], missed: [2], nextDayAt: "2026-11-06T12:00:00Z" }),
      }));
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
      await expect(page.getByRole("heading", { name: "Evening walk" })).toBeVisible();
      await expect(page.getByRole("heading", { name: experiment.question })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Check in for day 4" })).toBeVisible();
      await expect(page.getByRole("img", { name: "Evening walk: 2 of 7 days recorded in the last seven experiment days" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Evening walk: 10-day timeline" }).getByRole("listitem")).toHaveCount(10);
      const hero = page.getByRole("region", { name: "Your next action" });
      const week = page.getByRole("region", { name: "Your rhythm" });
      const heroBox = (await hero.boundingBox())!, weekBox = (await week.boundingBox())!;
      if (width >= 1024) expect(weekBox.x).toBeGreaterThan(heroBox.x + heroBox.width);
      else expect(weekBox.y).toBeGreaterThan(heroBox.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const capture = async (name: string) => {
        if (!process.env.CAPTURE_WEB_TODAY) return;
        await page.addStyleTag({ content: "nextjs-portal { display:none !important }" });
        await page.screenshot({ path: `../docs/screenshots/web-parity/today/${width}-${theme}-${name}.png`, fullPage: true });
      };
      await capture("due");
      await hero.getByText("Details", { exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(hero.getByText(experiment.question, { exact: true })).toBeVisible();
      await page.keyboard.press("Enter");
      recorded = true;
      await page.reload();
      await expect(page.getByText("Done for today", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Change today's answers" })).toBeVisible();
      await capture("recorded");
      unavailable = true;
      await page.reload();
      await expect(page.getByRole("alert")).toContainText("Temporarily unavailable");
      await capture("error");
      unavailable = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByRole("heading", { name: "Evening walk" })).toBeVisible();
      expect(counts.proposals).toBe(0);
      expect(errors).toEqual([]);
    });
  }
}
