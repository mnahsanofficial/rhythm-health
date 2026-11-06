import { expect, test } from "@playwright/test";
import { proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";
const suggested = "Does a short outdoor break help my afternoon focus?";
const message = "That is a broader question. A personal experiment needs one small daily action that you can repeat and observe, so here is a related habit question you could try.";
for (const width of [390, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`soft habit and safety choices at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page); await createAccountAndSaveProfile(page, counts);
    let safety = false, calls = 0;
    await page.route(`${API}/api/experiments/propose`, route => {
      calls++;
      return route.fulfill({ json: safety ? { ...proposeResponse, proposal: null, prediction: null, safety: { allowed: false, reason: "This change is outside a small habit experiment.", suggested_alternative: "Choose a gentler daily routine.", suggested_question: suggested } }
        : { ...proposeResponse, proposal: null, prediction: null, habit_check: { message, suggested_question: suggested } } });
    });
    const capture = async (state: string) => {
      if (!process.env.CAPTURE_WEB_QUESTION) return;
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `../docs/screenshots/web-parity/question/${width}-${theme}-${state}.png`, fullPage: true });
    };
    await page.goto("/experiments/new");
    const field = page.getByRole("textbox", { name: "Your question or goal" });
    await field.fill("How can I get more from my working day?");
    await page.getByRole("button", { name: "Design experiment" }).click();
    await expect(page.getByRole("heading", { name: "Turn it into a habit question.", level: 2 })).toBeFocused();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Design experiment" })).toHaveCount(0);
    await capture("soft-check");
    await page.getByRole("button", { name: "Use this instead" }).click();
    await expect(field).toHaveValue(suggested); await expect(field).toBeFocused();
    expect(calls).toBe(1); await capture("filled");
    safety = true;
    await page.getByRole("button", { name: "Design experiment" }).click();
    await expect(page.getByRole("heading", { name: "Let's find a gentler experiment.", level: 2 })).toBeFocused();
    await expect(page.getByRole("button", { name: "Continue anyway" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Design experiment" })).toBeDisabled();
    await capture("safety");
    await page.getByRole("button", { name: "Use this instead" }).click();
    await expect(field).toHaveValue(suggested); await expect(field).toBeFocused();
    await expect(page.getByRole("button", { name: "Design experiment" })).toBeEnabled();
    expect(calls).toBe(2); expect(counts.proposals).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
