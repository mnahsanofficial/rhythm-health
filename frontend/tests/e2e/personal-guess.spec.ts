import { expect, test } from "@playwright/test";
import type { LabReport, ProposeResponse, SaveExperimentRequest } from "@rhythm-health/contract";
import { experiment, labReport, proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1440]) for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`commit your own guess before the forecast at ${width}px, motion ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion });
    // No request can reach Supabase, OpenRouter, fonts or any other external host.
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    const response: ProposeResponse = { ...proposeResponse, personal_guess_available: true };
    await page.route(`${API}/api/experiments/propose`, route => route.fulfill({ json: response }));
    let saved: SaveExperimentRequest | null = null;
    await page.route(`${API}/api/experiments`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      saved = route.request().postDataJSON() as SaveExperimentRequest;
      return route.fulfill({ status: 201, json: { ...experiment, personal_guess_percent: saved.personal_guess_percent } });
    });
    await page.goto("/experiments/new");
    await page.getByRole("textbox", { name: "Your question or goal" }).fill("Does an evening walk help my morning energy?");
    await page.getByRole("button", { name: "Design my experiment" }).click();
    const input = page.getByRole("textbox", { name: "Your guess for Morning energy" });
    await expect(input).toBeVisible();
    await expect(page.getByText("The original forecast")).toHaveCount(0);
    await input.fill("-12.5");
    const capture = async (state: string) => {
      if (!process.env.CAPTURE_PERSONAL_GUESS || reducedMotion !== "no-preference") return;
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: `../docs/screenshots/personal-guess/${width}-${state}.png`, fullPage: true });
    };
    await capture("guess-before-ai");
    await page.getByRole("button", { name: "Reveal the AI prediction" }).click();
    await expect(page.getByText("The original forecast")).toBeVisible();
    await expect(input).toHaveCount(0);
    await capture("forecast");
    await page.getByRole("button", { name: "Start this experiment" }).click();
    await expect(page).toHaveURL(`/experiments/${experiment.id}`);
    expect(saved).toMatchObject({ personal_guess_percent: -12.5 });
    const report: LabReport = {
      ...labReport,
      experiment: { ...labReport.experiment, personal_guess_percent: -12.5 },
      analysis: { ...labReport.analysis, personal_guess: {
        guessed_change_percent: -12.5,
        observed_change_percent: labReport.analysis.prediction!.observed_change_percent,
        error_points: 33,
      } },
    };
    await page.route(`${API}/api/experiments/${experiment.id}/report`, route => route.fulfill({ json: report }));
    await page.goto(`/experiments/${experiment.id}/report`);
    await expect(page.getByText("Your guess", { exact: true })).toBeVisible();
    await capture("report-before");
    await page.getByRole("button", { name: "Reveal my result" }).click();
    await expect(page.getByRole("status").filter({ hasText: "33 percentage points" })).toBeVisible();
    await capture("report-during");
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        if (Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))) animation.finish();
      }
    });
    await capture("report-after");
    if (reducedMotion === "reduce") {
      const reveal = page.getByRole("region", { name: "Prediction vs reality" });
      expect(await reveal.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(counts.proposals).toBe(0); // Our handler intercepted the only (fake) proposal.
  });
}
