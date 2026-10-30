import { timelineFixture } from "../support/timeline-fixture";
import { expect, test } from "@playwright/test";
import type { Checkin, Experiment } from "@/lib/types/api";
import { experiment, labReport, writtenLabReport } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 768, 1440]) {
  test(`finish, see the analysis, write the report and run the next experiment at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);

    // An experiment whose days have ended, with all ten check-ins.
    const ended: Experiment = {
      ...experiment, status: "active", started_at: "2026-10-18T08:00:00Z",
      progress: {
        state: "ended", day_number: 10, phase: "intervention", phase_day: 7, phase_days: 7,
        total_days: 10, days_remaining: 0, started_at: "2026-10-18T08:00:00Z", ends_at: "2026-10-28T08:00:00Z",
      },
    };
    const checkins: Checkin[] = labReport.chart.points.map(p => ({
      id: `day-${p.day}`, experiment_id: experiment.id, phase: p.phase as Checkin["phase"], day_number: p.day,
      intervention_completed: p.intervention_completed ?? false, metric_values: p.values ?? {}, note: p.note,
      created_at: "2026-10-28T08:00:00Z", updated_at: "2026-10-28T08:00:00Z",
    }));
    let completed = false;
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: completed ? labReport.experiment : ended }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({
      json: timelineFixture(completed ? labReport.experiment : ended, { recorded: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
    }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: checkins }));
    await page.route(`${API}/api/experiments/${experiment.id}/complete`, route => {
      completed = true;
      return route.fulfill({ json: labReport });
    });

    let written = false;
    let posts = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`${API}/api/experiments/${experiment.id}/report**`, async route => {
      if (route.request().method() === "POST") {
        posts += 1;
        expect(new URL(route.request().url()).searchParams.has("regenerate")).toBe(false);
        await gate;
        written = true;
        await route.fulfill({ json: writtenLabReport });
        return;
      }
      await route.fulfill({ json: written ? writtenLabReport : labReport });
    });

    // Finish the experiment: the deterministic analysis, no model call.
    await page.goto(`/experiments/${experiment.id}`);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "Finish and see results" }).click();
    await page.getByRole("button", { name: "Yes, finish" }).click();
    await expect(page).toHaveURL(`/experiments/${experiment.id}/report`);
    expect(completed).toBe(true);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    // Full-page captures would draw the sticky header wherever the page was scrolled.
    if (process.env.CAPTURE_REPORT) await page.addStyleTag({ content: "header { position: static !important; }" });
    // The analysis is there straight away; the written report waits for the person.
    await expect(page.getByRole("region", { name: "Likely signal" })).toContainText("+21%");
    const write = page.getByRole("button", { name: "Write my report" });
    await write.dblclick();
    await expect(page.getByRole("button", { name: "Writing your report…" })).toBeDisabled();
    if (process.env.CAPTURE_REPORT) await page.screenshot({ path: `../docs/screenshots/lab-report-v2/${width}-writing.png`, fullPage: true });
    release();

    const learning = page.getByRole("region", { name: "What you learned about you" });
    await expect(learning.getByText(writtenLabReport.narrative!.summary)).toBeVisible();
    await expect(page.getByRole("heading", { name: "What you learned about you" })).toBeFocused();
    expect(posts).toBe(1);
    if (process.env.CAPTURE_REPORT) await page.screenshot({ path: `../docs/screenshots/lab-report-v2/${width}-written.png`, fullPage: true });

    // Reloading reads the stored narrative; it doesn't write it again.
    await page.reload();
    await expect(page.getByText(writtenLabReport.narrative!.summary)).toBeVisible();
    expect(posts).toBe(1);

    const run = page.getByRole("link", { name: "Run this experiment" });
    await run.click();
    await expect(page.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(writtenLabReport.narrative!.next_experiment.question);
    expect(counts.proposals).toBe(0);
  });
}
