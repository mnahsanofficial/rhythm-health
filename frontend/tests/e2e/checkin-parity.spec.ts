import { expect, test } from "@playwright/test";
import { MOTION_DURATION_MS } from "@rhythm-health/brand";
const settle = MOTION_DURATION_MS.response + MOTION_DURATION_MS.step + MOTION_DURATION_MS.press;
import type { Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`step check-in, keyboard, review and edit at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page); await createAccountAndSaveProfile(page, counts);
    const active: Experiment = { ...experiment, status: "active", progress: { ...experiment.progress,
      state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
    } };
    let posts = 0; let body: unknown;
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({ json: timelineFixture(active, { recorded: posts > 1 ? [1, 2, 3, 4] : [1, 2, 3] }) }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      posts++; body = route.request().postDataJSON();
      if (posts === 1) return route.fulfill({ status: 503, json: { detail: "Please try saving again" } });
      return route.fulfill({ json: { ...body as object, id: "44444444-4444-4444-8444-444444444444", experiment_id: experiment.id, phase: "intervention", day_number: 4,
        created_at: "2026-11-06T09:00:00Z", updated_at: "2026-11-06T09:00:00Z" } });
    });
    const capture = async (state: string) => {
      if (!process.env.CAPTURE_WEB_CHECKIN) return;
      await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `../docs/screenshots/web-parity/checkin/${width}-${theme}-${state}.png`, fullPage: true });
    };
    await page.goto(`/experiments/${experiment.id}/check-in`);
    await expect(page.getByRole("heading", { name: "Did you make the change?", level: 1 })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Did you make the change?" })).toBeVisible();
    await capture("change");
    await page.keyboard.press("1");
    await expect(page.getByRole("heading", { name: "Morning energy", level: 1 })).toBeFocused();
    await capture("question");
    await page.keyboard.press("7");
    await expect(page.getByRole("heading", { name: "Sleep quality", level: 1 })).toBeFocused();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.keyboard.press("8");
    await expect(page.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.press("6");
    await expect(page.getByRole("heading", { name: "Review your check-in.", level: 1 })).toBeFocused();
    await capture("review");
    await page.getByRole("button", { name: "Save check-in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Please try saving again");
    await capture("retry");
    await page.getByRole("button", { name: /Change Morning energy/ }).click();
    await page.keyboard.press("9");
    await expect(page.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /Change Morning energy/ })).toContainText("9/10");
    await page.getByRole("button", { name: "Save check-in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Day 4 recorded." })).toBeFocused();
    await expect(page.getByText("6 days left", { exact: true })).toBeVisible();
    await capture("celebration");
    const celebration = (await page.getByRole("main").locator("svg").first().boundingBox())!;
    const celebrationMarker = (await page.locator("[data-celebration-marker]").boundingBox())!;
    expect(celebrationMarker.y).toBeGreaterThan(celebration.y + celebration.height / 2);
    expect(body).toEqual({ metric_values: { morning_energy: 9, sleep_quality: 6 }, intervention_completed: true, note: null });
    await page.getByRole("button", { name: "Change today's answers" }).click();
    await expect(page.getByRole("radio", { name: "Yes", exact: true })).toBeChecked();
    await page.getByText("Not today", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Did you make the change?" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "9", exact: true })).toBeChecked();
    await capture("edit");
    const scene = (await page.locator("figure").boundingBox())!;
    const marker = (await page.locator("[data-checkin-marker]").boundingBox())!;
    expect(marker.x).toBeGreaterThan(scene.x + scene.width / 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(await page.getByRole("main").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
    expect(posts).toBe(2); expect(counts.proposals).toBe(0); expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`Back cancels advancement and an answered step waits for Next at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page); await createAccountAndSaveProfile(page, counts);
    const active: Experiment = { ...experiment, status: "active", progress: { ...experiment.progress,
      state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
    } };
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({ json: timelineFixture(active) }));
    await page.goto(`/experiments/${experiment.id}/check-in`);
    await page.getByText("Yes", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    await page.getByRole("group", { name: "Morning energy" }).getByText("7", { exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForTimeout(settle); // Beyond the response + hold: a cancelled timer must not move the new step.
    await expect(page.getByRole("heading", { name: "Did you make the change?" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("radio", { name: "7", exact: true })).toBeChecked();
    const capture = async (phase: string) => {
      if (!process.env.CAPTURE_WEB_CHECKIN) return;
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `../docs/screenshots/web-parity/checkin/motion-${width}-${phase}.png`, fullPage: true });
    };
    await capture("before");
    await page.getByRole("group", { name: "Morning energy" }).getByText("8", { exact: true }).click();
    await capture("during");
    await page.waitForTimeout(settle);
    await expect(page.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "8", exact: true })).toBeChecked();
    await capture("after");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Sleep quality" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(settle);
    await expect(page.getByRole("heading", { name: "Sleep quality" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "10", exact: true })).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Review your check-in." })).toBeVisible();
    expect(counts.proposals).toBe(0);
  });
}
