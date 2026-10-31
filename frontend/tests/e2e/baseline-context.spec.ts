import { expect, test } from "@playwright/test";
import type { ExperimentTimeline } from "@rhythm-health/contract";
import baseline from "../support/baseline-summary.json";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 768, 1440]) for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`normal-day handoff at ${width}px, motion ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page); await createAccountAndSaveProfile(page, counts);
    const active = { ...experiment, metrics: [
      { key: "morning_energy", label: "Morning energy", type: "scale", min: 1, max: 10, primary: true },
      { key: "breaks", label: "Breaks", type: "number", min: null, max: null, primary: false },
      { key: "sleep_time", label: "Time to fall asleep", type: "duration", min: null, max: null, primary: false },
      { key: "screen_free", label: "Screen-free evening", type: "boolean", min: null, max: null, primary: false },
    ], status: "active", started_at: "2026-10-28T09:00:00Z", progress: { ...experiment.progress, state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6, started_at: "2026-10-28T09:00:00Z", ends_at: "2026-11-07T09:00:00Z" } } satisfies import("@rhythm-health/contract").Experiment;
    const normalTimeline: ExperimentTimeline = { ...timelineFixture(active, { recorded: [1, 3], missed: [2] }), baseline_summary: baseline };
    let timeline = normalTimeline;
    const normalCheckins = [1, 3].map(day => ({ id: `44444444-4444-4444-8444-44444444444${day}`, experiment_id: active.id, day_number: day, phase: "baseline",
      intervention_completed: false, metric_values: { morning_energy: day === 1 ? 5 : 6, breaks: day === 1 ? 0 : 2, sleep_time: day === 1 ? 15 : 25.5, screen_free: day === 3 },
      note: null, created_at: "2026-10-28T09:00:00Z", updated_at: "2026-10-28T09:00:00Z" }));
    let logged = normalCheckins;
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: logged }));
    let fail = false;
    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => {
      expect(route.request().headers()["authorization"]).toBe("Bearer fake-e2e-access-token");
      if (fail) { fail = false; return route.fulfill({ status: 503, json: { detail: "Progress unavailable" } }); }
      return route.fulfill({ json: timeline });
    });
    const capture = async (state: string) => {
      if (!process.env.CAPTURE_BASELINE || reducedMotion !== "reduce") return;
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `../docs/screenshots/baseline-context/web-${width}-${state}.png`, fullPage: true });
    };
    for (const path of ["/", `/experiments/${experiment.id}`]) {
      await page.goto(path); const context = page.getByRole("region", { name: "Your normal, before the change." });
      await expect(context).toBeVisible();
      for (const metric of baseline.metrics) await expect(context.getByText(metric.description, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Check in for day 4", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(path === "/" ? "home" : "detail");
    }
    logged = []; timeline = { ...timelineFixture(active, { missed: [1, 2, 3] }), baseline_summary: { ...baseline, days_recorded: 0, metrics: [] } };
    await page.goto("/"); await expect(page.getByText("No normal-day answers recorded.")).toBeVisible(); await capture("empty");
    logged = normalCheckins; timeline = normalTimeline; fail = true;
    await page.reload(); await expect(page.getByRole("main").getByRole("alert")).toContainText("Progress unavailable");
    await expect(page.getByText(baseline.metrics[0].description)).toHaveCount(0); await capture("error");
    await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByText(baseline.metrics[0].description)).toBeVisible();
    logged = normalCheckins.slice(0, 1); timeline = timelineFixture({ ...active, progress: { ...timeline.progress, day_number: 3, phase: "baseline", phase_day: 3, phase_days: 3 } }, { recorded: [1], missed: [2] });
    await page.reload(); await expect(page.getByRole("link", { name: "Check in for day 3", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your normal, before the change." })).toHaveCount(0); await capture("baseline");
    expect(counts.proposals).toBe(0); expect(counts.saves).toBe(0); expect(counts.starts).toBe(0); expect(errors).toEqual([]);
  });
}
