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
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
      if (process.env.CAPTURE_WEB_TODAY) {
        await page.addStyleTag({ content: "nextjs-portal { display:none !important }" });
        await page.screenshot({ path: `../docs/screenshots/web-parity/today/${width}-${theme}-empty.png`, fullPage: true });
      }
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
      await expect(hero.getByText(experiment.question, { exact: true })).toBeHidden();
      await hero.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(hero.getByText(experiment.question, { exact: true })).toBeVisible();
      const fullQuestion = (await hero.getByText(experiment.question, { exact: true }).boundingBox())!;
      const checkin = (await hero.getByRole("link", { name: "Check in for day 4" }).boundingBox())!;
      expect(fullQuestion.y + fullQuestion.height).toBeLessThan(checkin.y);
      await capture("details");
      await page.keyboard.press("Enter");
      recorded = true;
      await page.reload();
      await expect(page.getByText("Done for today", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Change today's answers" })).toBeVisible();
      await capture("recorded");
      unavailable = true;
      await page.reload();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Temporarily unavailable");
      await capture("error");
      unavailable = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByRole("heading", { name: "Evening walk" })).toBeVisible();
      expect(counts.proposals).toBe(0);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`Today ring reveal at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    const active: Experiment = { ...experiment, status: "active", progress: {
      ...experiment.progress, state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
    } };
    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, async route => {
      await gate;
      return route.fulfill({ json: timelineFixture(active, { recorded: [1, 2, 3] }) });
    });
    const capture = async (phase: string) => {
      if (!process.env.CAPTURE_WEB_TODAY || reducedMotion === "reduce") return;
      await page.addStyleTag({ content: "nextjs-portal { display:none !important }" });
      await page.screenshot({ path: `../docs/screenshots/web-parity/today/motion-${width}-${phase}.png`, fullPage: true });
    };
    await page.goto("/");
    await expect(page.getByRole("status", { name: "Loading your lab" })).toBeVisible();
    await capture("before");
    release();
    await page.getByRole("heading", { name: "Evening walk" }).waitFor();
    await capture("during");
    const ring = page.getByRole("img", { name: "Evening walk: 3 of 7 days recorded in the last seven experiment days" });
    await expect(ring).toBeVisible();
    await expect(ring.locator("circle").nth(1)).toHaveCSS("opacity", "1");
    await capture("after");
    if (reducedMotion === "reduce") {
      expect(await page.getByRole("main").evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
    }
    await expect(page.getByRole("link", { name: "Check in for day 4" })).toBeEnabled();
    expect(counts.proposals).toBe(0);
  });
}
