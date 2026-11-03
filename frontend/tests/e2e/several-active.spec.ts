import { expect, test } from "@playwright/test";
import type { Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

function running(n: number, day: number): Experiment {
  return {
    ...experiment,
    id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`,
    question: `Does habit number ${n} help my morning energy?`,
    status: "active",
    started_at: "2026-10-25T10:00:00Z",
    progress: {
      state: "in_progress", day_number: day, phase: "baseline", phase_day: day, phase_days: 3, total_days: 10,
      days_remaining: 10 - day, started_at: "2026-10-25T10:00:00Z", ends_at: "2026-11-04T10:00:00Z",
    },
  };
}

for (const width of [390, 1440]) {
  test(`Your lab with three experiments at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    const all = [running(1, 1), running(2, 2), running(3, 3)];
    await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: all }));
    await page.route(`${API}/api/experiments/capacity`, route => route.fulfill({ json: { active: 3, limit: 3, can_start: false } }));
    for (const item of all) {
      await page.route(`${API}/api/experiments/${item.id}/progress`, route => route.fulfill({ json: timelineFixture(item) }));
    }
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "3 experiments running", level: 1 })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByText("You're running 3 experiments, the most at once.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Test another habit" })).toHaveCount(0);
    const second = page.getByRole("article", { name: all[1].question });
    await expect(second.getByRole("link", { name: "Check in for day 2" })).toHaveAttribute("href", `/experiments/${all[1].id}/check-in`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
