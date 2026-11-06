import { expect, test } from "@playwright/test";
import { proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`four-step plan at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page); await createAccountAndSaveProfile(page, counts);
    await page.route(`${API}/api/experiments/propose`, route => route.fulfill({ json: { ...proposeResponse, personal_guess_available: true } }));
    await page.goto("/experiments/new");
    await page.getByRole("textbox", { name: "Your question or goal" }).fill("Does an evening walk help my morning energy?");
    await page.getByRole("button", { name: "Design experiment" }).click();
    await expect(page.getByRole("heading", { level: 1, name: proposeResponse.proposal!.intervention.change_short! })).toBeFocused();
    const capture = async (step: string) => {
      if (!process.env.CAPTURE_WEB_PLAN) return;
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `../docs/screenshots/web-parity/plan/${width}-${theme}-${step}.png`, fullPage: true });
    };
    await capture("change");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Your guess for Morning energy" });
    await expect(input).toBeVisible(); await input.fill("-12.5");
    await expect(page.getByRole("status")).toContainText("-12.5%");
    await expect(page.getByText("The original forecast", { exact: true })).toHaveCount(0);
    await capture("guess");
    await page.getByRole("button", { name: "Show prediction" }).click();
    await expect(page.getByText("Your guess", { exact: true })).toBeVisible();
    await expect(page.getByText("The original forecast", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start this experiment" })).toHaveCount(0);
    await capture("reveal");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/Your check-ins decide, not the AI/)).toBeVisible();
    await capture("days");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Start this experiment" }).click();
    await expect(page).toHaveURL(/\/experiments\/[a-f0-9-]+$/);
    expect(counts.proposals).toBe(0);
  });
}
