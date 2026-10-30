import { expect, test } from "@playwright/test";
import type { Experiment } from "@rhythm-health/contract";
import backend from "../support/early-finish-reports.json";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 768, 1440]) {
  test(`authoritative progress loading, retry and lifecycle states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // A catch-all prevents accidental external calls; registered fake API/auth handlers take priority.
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue() : route.abort());
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);

    const active: Experiment = {
      ...experiment, status: "active", started_at: "2026-10-28T09:00:00Z",
      progress: {
        ...experiment.progress, state: "in_progress", day_number: 4,
        phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
        started_at: "2026-10-28T09:00:00Z", ends_at: "2026-11-07T09:00:00Z",
      },
    };
    const progress = timelineFixture(active, { recorded: [1, 3], missed: [2], nextDayAt: "2026-11-01T09:00:00Z" });
    const logged = [1, 3].map(day => ({
      id: `day-${day}`, experiment_id: experiment.id, day_number: day, phase: "baseline",
      intervention_completed: false, metric_values: { morning_energy: 6, sleep_quality: 7 },
      note: null, created_at: "2026-10-28T09:00:00Z", updated_at: "2026-10-28T09:00:00Z",
    }));
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: logged }));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, async route => {
      expect(route.request().headers()["authorization"]).toBe("Bearer fake-e2e-access-token");
      requests += 1;
      if (requests === 1) {
        await gate;
        await route.fulfill({ status: 503, json: { detail: "Progress unavailable" } });
      } else await route.fulfill({ json: progress });
    });
    const capture = async (state: string) => {
      if (!process.env.CAPTURE_PROGRESS) return;
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `../docs/screenshots/progress-endpoint/${width}-${state}.png`, fullPage: true });
    };
    await page.goto(`/experiments/${experiment.id}`);
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByRole("heading", { name: experiment.question })).toHaveCount(0);
    await capture("loading");
    release();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Progress unavailable");
    await capture("error");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByLabel("Day 2, baseline, missed", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Day 4, test, today, not logged yet", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Day 10, test, upcoming", { exact: true })).toBeVisible();
    await expect(page.getByText("2 of 10 days logged", { exact: true })).toBeVisible();
    await capture("active");
    expect(requests).toBe(2);

    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
    await page.goto("/");
    await expect(page.getByText("Day 4 of 10", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Day 2, baseline, missed", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check in for day 4" })).toBeVisible();
    await capture("home");

    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: experiment }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: [] }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({ json: timelineFixture(experiment) }));
    await page.goto(`/experiments/${experiment.id}`);
    await expect(page.getByRole("heading", { name: "This experiment hasn't started." })).toBeVisible();
    await expect(page.getByLabel(/, missed$/)).toHaveCount(0);
    await capture("not-started");

    const ended: Experiment = { ...active, progress: {
      ...active.progress, state: "ended", day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0,
    } };
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: ended }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({
      json: timelineFixture(ended, { missed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
    }));
    await page.goto(`/experiments/${experiment.id}`);
    await expect(page.getByRole("heading", { name: "All 10 days are done." })).toBeVisible();
    await expect(page.getByLabel(/, missed$/)).toHaveCount(10);
    await capture("ended");

    const completed = backend.cases.find(item => item.name === "today-unlogged")!;
    const id = completed.report.experiment.id;
    await page.route(`${API}/api/experiments/${id}`, route => route.fulfill({ json: completed.report.experiment }));
    await page.route(`${API}/api/experiments/${id}/checkins`, route => route.fulfill({ json:
      completed.report.chart.points.filter(point => point.logged).map(point => ({
        id: `day-${point.day}`, experiment_id: id, day_number: point.day, phase: point.phase,
        intervention_completed: point.intervention_completed, metric_values: point.values, note: point.note,
        created_at: completed.report.created_at, updated_at: completed.report.created_at,
      })),
    }));
    await page.route(`${API}/api/experiments/${id}/progress`, route => route.fulfill({ json: completed.timeline }));
    await page.goto(`/experiments/${id}`);
    await expect(page.getByRole("heading", { name: "Your results are ready." })).toBeVisible();
    await expect(page.getByLabel("Day 2, baseline, missed", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Day 10, test, not recorded before completion", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/, missed$/)).toHaveCount(1);
    await capture("completed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(counts.proposals + counts.saves + counts.starts).toBe(0);
    expect(errors).toEqual([]);
  });
}
