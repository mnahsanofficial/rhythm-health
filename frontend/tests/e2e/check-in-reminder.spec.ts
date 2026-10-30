import { timelineFixture } from "../support/timeline-fixture";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Checkin, Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

const started = "2026-10-26T08:00:00Z";
const active: Experiment = {
  ...experiment, status: "active", started_at: started,
  progress: {
    state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7,
    total_days: 10, days_remaining: 6, started_at: started, ends_at: "2026-11-05T08:00:00Z",
  },
};
const today: Checkin = {
  id: "today", experiment_id: experiment.id, phase: "intervention", day_number: 4, intervention_completed: true,
  metric_values: { morning_energy: 7, sleep_quality: 7 }, note: null,
  created_at: "2026-10-29T09:00:00Z", updated_at: "2026-10-29T09:00:00Z",
};

for (const width of [390, 768, 1440]) {
  test(`saves the next day to the calendar from Done for today at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: [today] }));

    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({
      json: timelineFixture(active, { recorded: [4], missed: [1, 2, 3], nextDayAt: "2026-10-30T08:00:00Z" }),
    }));
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page.getByText("Done for today", { exact: true })).toBeVisible();
    const add = page.getByRole("button", { name: "Add day 5 to your calendar" });
    const box = (await add.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (process.env.CAPTURE_REMINDER) await page.screenshot({ path: `${process.env.CAPTURE_REMINDER}/${width}-done-for-today.png` });

    const [download] = await Promise.all([page.waitForEvent("download"), add.click()]);
    expect(download.suggestedFilename()).toBe("rhythm-day-5.ics");
    const ics = (await readFile(await download.path(), "utf8")).replace(/\r\n /g, "");
    expect(ics).toContain("DTSTART:20261030T080000Z");
    expect(ics).toContain("SUMMARY:Rhythm check-in: day 5 of 10");
    expect(ics).toContain(`/experiments/${experiment.id}/check-in`);
    expect(ics).not.toContain(experiment.question);
    expect(counts.proposals).toBe(0);
  });
}
