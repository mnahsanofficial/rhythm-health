import { expect, test } from "@playwright/test";
import { proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

const SUGGESTED = "Does a 20-minute walk after dinner improve my morning energy?";

for (const width of [390, 1440]) {
  test(`a question that isn't about a habit gets a soft check at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    const bodies: unknown[] = [];
    await page.route(`${API}/api/experiments/propose`, async route => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      await route.fulfill({
        json: !body.continue_anyway
          ? { ...proposeResponse, proposal: null, prediction: null, habit_check: { message: "This doesn't look like a habit question.", suggested_question: SUGGESTED } }
          : proposeResponse,
      });
    });

    const field = page.getByRole("textbox", { name: "Your question or goal" });
    await field.fill("What's the capital of France?");
    await page.getByRole("button", { name: "Design experiment" }).click();
    await expect(page.getByText("This doesn't look like a habit question.")).toBeVisible();
    await expect(page.getByText(SUGGESTED)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.CAPTURE_SOFT_CHECK) {
      await page.screenshot({ path: `../docs/screenshots/soft-habit-check/web-${width}.png` });
    }

    await page.getByRole("button", { name: "Use this instead" }).click();
    await expect(field).toHaveValue(SUGGESTED);
    expect(bodies).toHaveLength(1);

    await field.fill("What's the capital of France?");
    await page.getByRole("button", { name: "Design experiment" }).click();
    await page.getByRole("button", { name: "Continue anyway" }).click();
    await expect(page.getByRole("button", { name: /start this experiment/i })).toBeVisible();
    await expect(page.getByText("Your question wasn't about a habit, so Rhythm suggested a related habit experiment instead.")).toBeVisible();
    await page.screenshot({ path: `/tmp/proposal-continued-${width}.png`, fullPage: true });
    expect(bodies.at(-1)).toEqual({ question: "What's the capital of France?", continue_anyway: true });
    await page.getByRole("button", { name: "Ask something else" }).click();
    await page.route(`${API}/api/experiments/propose`, async route => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ json: { ...proposeResponse, proposal: null, prediction: null,
        safety: { allowed: false, reason: "This is not a safe experiment.", suggested_question: SUGGESTED, suggested_alternative: null } } });
    });
    await field.fill("A question that the server blocks");
    await page.getByRole("button", { name: "Design experiment" }).click();
    await expect(page.getByText("This is not a safe experiment.")).toBeVisible();
    const design = page.getByRole("button", { name: "Design experiment" });
    await expect(design).toBeDisabled();
    const requests = bodies.length;
    await field.press("Control+Enter");
    expect(bodies).toHaveLength(requests);
    await page.screenshot({ path: `/tmp/proposal-blocked-${width}.png`, fullPage: true });
    await field.fill("A different habit question");
    await expect(design).toBeEnabled();
  });
}
