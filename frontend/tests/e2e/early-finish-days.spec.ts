import { expect, test } from "@playwright/test";
import backend from "../support/early-finish-reports.json";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const timezoneId of ["Asia/Dhaka", "America/Toronto"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    for (const width of [390, 1440]) {
      test(`keeps backend missing days across early finish and DST at ${width}px`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        const counts = await installApiMocks(page);
        await answerOnboardingWithMouse(page);
        await createAccountAndSaveProfile(page, counts);
        // Date is fixed per case; normal timers and keyboard interactions keep running.
        // The fake auth session stays valid when a fixture's clock advances into November.
        await page.route("https://supabase.test.invalid/auth/v1/token**", route => route.fulfill({ json: {
          access_token: "fake-e2e-access-token", refresh_token: "fake-e2e-refresh-token",
          token_type: "bearer", expires_in: 2_000_000_000, expires_at: 4_102_444_800,
          user: {
            id: "11111111-1111-4111-8111-111111111111", email: "learner@example.invalid",
            aud: "authenticated", role: "authenticated", app_metadata: { provider: "email" },
            user_metadata: {}, identities: [], created_at: "2026-10-26T05:30:00Z",
          },
        } }));
        const first = backend.first_day.experiment;
        await page.route(`${API}/api/experiments/${first.id}`, route => route.fulfill({ json: first }));
        await page.route(`${API}/api/experiments/${first.id}/checkins`, route => route.fulfill({ json: [] }));
        await page.route(`${API}/api/experiments/${first.id}/progress`, route => route.fulfill({ json: backend.first_day.timeline }));
        await page.clock.setFixedTime(new Date(backend.first_day.clock));
        await page.goto(`/experiments/${first.id}`);
        await expect(page.getByLabel("Day 1, baseline, today, not logged yet", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Day 10, test, upcoming", { exact: true })).toBeVisible();
        await expect(page.getByLabel(/, missed$/)).toHaveCount(0);

        for (const scenario of backend.cases) {
          const { report, expected } = scenario;
          const id = report.experiment.id;
          const logged = report.chart.points.filter(point => point.logged).map(point => ({
            id: `00000000-0000-4000-8000-${String(point.day).padStart(12, "0")}`, experiment_id: id, day_number: point.day, phase: point.phase,
            intervention_completed: point.intervention_completed, metric_values: point.values,
            note: point.note, created_at: report.created_at, updated_at: report.created_at,
          }));
          await page.route(`${API}/api/experiments/${id}`, route => route.fulfill({ json: report.experiment }));
          await page.route(`${API}/api/experiments/${id}/checkins`, route => route.fulfill({ json: logged }));
          await page.route(`${API}/api/experiments/${id}/report`, route => route.fulfill({ json: report }));
          await page.route(`${API}/api/experiments/${id}/progress`, route => route.fulfill({ json: scenario.timeline }));
          await page.clock.setFixedTime(new Date(scenario.clock));
          await page.goto(`/experiments/${id}/report`);
          const chart = page.getByRole("region", { name: "Day by day", exact: true });
          await expect(chart).toBeVisible();
          const missedText = `Missed: ${expected.missing_days.length === 1 ? "day" : "days"} ${expected.missing_days.join(", ")}.`;
          await expect(chart.getByText(missedText, { exact: true })).toBeVisible();
          if (expected.not_reached_days.length) {
            const list = `${expected.not_reached_days.length === 1 ? "day" : "days"} ${expected.not_reached_days.join(", ")}`;
            await expect(chart.getByText(`Not reached before you finished: ${list}.`, { exact: true })).toBeVisible();
          } else {
            await expect(chart.getByText(/Not reached before you finished/)).toHaveCount(0);
          }
          await expect(chart.getByRole("button", { name: /^Day \d+/ })).toHaveCount(expected.logged_days.length);
          const localDate = new Date(report.experiment.completed_at!).toLocaleDateString("en-US", { timeZone: timezoneId, day: "numeric", month: "long" });
          await expect(page.getByText(`Lab Report · finished ${localDate}`, { exact: true })).toBeVisible();
          expect(report.analysis.adherence.coverage_rate).toBeCloseTo(expected.coverage_rate, 3);
          // The detail timeline must use the same backend-owned list as the report chart.
          await page.getByRole("link", { name: "← Your experiment", exact: true }).click();
          const timeline = page.getByRole("region", { name: "Your timeline", exact: true });
          await expect(timeline).toBeVisible();
          for (const day of expected.missing_days) {
            await expect(timeline.getByLabel(`Day ${day}, ${day <= 3 ? "baseline" : "test"}, missed`, { exact: true })).toBeVisible();
          }
          await expect(timeline.getByLabel(/, missed$/)).toHaveCount(expected.missing_days.length);
          for (const day of expected.not_reached_days) {
            await expect(timeline.getByLabel(`Day ${day}, test, not recorded before completion`, { exact: true })).toBeVisible();
          }
          if (process.env.CAPTURE_F2_F4 && scenario.name === "today-unlogged") {
            await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `../docs/screenshots/f2-f4-verification/isolated/${timezoneId.replace("/", "-")}-${width}-timeline.png`, fullPage: true });
          }
        }
        expect(counts.proposals).toBe(0);
        expect(counts.saves).toBe(0);
        expect(counts.starts).toBe(0);
      });
    }
  });
}
