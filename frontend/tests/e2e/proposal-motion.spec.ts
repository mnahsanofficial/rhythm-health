import { expect, test } from "@playwright/test";
import { proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`proposal feedback at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      await page.emulateMedia({ reducedMotion });
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`${API}/api/experiments/propose`, async route => {
        await gate;
        await route.fulfill({ json: {
          ...proposeResponse,
          classification: { ...proposeResponse.classification, risk: "review" },
          safety: { allowed: true, reason: "Keep the walk comfortable.", suggested_alternative: null },
        } });
      });
      const capture = async (frame: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: `../docs/screenshots/ui-motion/proposal/${width}/${frame}.png`, fullPage: true });
      };
      await page.goto("/experiments/new");
      await page.getByRole("textbox", { name: "Your question or goal" }).fill("Does walking after dinner help my energy?");
      await capture("question");
      await page.getByRole("button", { name: "Design experiment" }).click();
      await expect(page.getByRole("region", { name: "Preparing your experiment" })).toBeVisible();
      await expect(page.getByRole("list", { name: "What goes into your experiment" })).toContainText("Forecasting what might happen");
      await capture("before");
      release();
      const preview = page.getByRole("region", { name: "Experiment and prediction preview" });
      await expect(preview.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Your question or goal" })).toHaveCount(0);
      await preview.locator("summary").filter({ hasText: "A note before you begin" }).click();
      await expect(preview.getByRole("note")).toContainText("Keep the walk comfortable.");
      await capture("during");
      await preview.getByRole("button", { name: "Next", exact: true }).click();
      const forecast = page.getByRole("complementary", { name: "Prediction and guess" });
      await expect(forecast.getByRole("figure", { name: /Predicted range/ })).toBeVisible();
      await expect(preview.getByText("+8% to +15%", { exact: true })).toBeVisible();
      await capture("after");
      if (reducedMotion === "reduce") {
        expect(await preview.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      }
      await preview.getByRole("button", { name: "Back", exact: true }).click();
      await preview.getByRole("button", { name: "Ask something else" }).click();
      await expect(page.getByRole("textbox", { name: "Your question or goal" })).toBeFocused();
      expect(counts.proposals).toBe(0); // This spec overrides the proposal with a gated mock.
    });
  }
}
