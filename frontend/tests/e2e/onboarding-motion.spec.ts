import { expect, test } from "@playwright/test";
import { profileInput } from "../support/fixtures";
import { installApiMocks } from "./helpers";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`onboarding habit choices at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      const hydrationErrors: string[] = [];
      page.on("console", message => {
        if (/hydration|didn't match|did not match/i.test(message.text())) hydrationErrors.push(message.text());
      });
      await installApiMocks(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Stop guessing/ })).toBeVisible();
      expect(hydrationErrors).toEqual([]);
      await page.evaluate(draft => localStorage.setItem("rhythm.onboarding.draft", JSON.stringify({ step: 6, draft })), {
        ...profileInput, regular_habits: [], constraints: [],
      });
      await page.goto("/onboarding");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.getByRole("heading", { name: "Morning", exact: true })).toBeVisible();
      const capture = async (frame: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: `../docs/screenshots/ui-motion/onboarding/${width}/${frame}.png`, fullPage: true });
      };
      await capture("habits-before");
      await page.getByText("Coffee around 9am", { exact: true }).click();
      await capture("habits-during");
      await expect(page.getByRole("checkbox", { name: "Coffee around 9am" })).toBeChecked();
      await expect(page.getByRole("status").filter({ hasText: "1 habit" })).toBeVisible();
      await capture("habits-after");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Anything that limits what you can change?" })).toBeVisible();
      await page.getByText("Shift work", { exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "1 thing to work around" })).toBeVisible();
      await capture("constraints");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.getByRole("checkbox", { name: "Coffee around 9am" })).toBeChecked();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByText("Shift work", { exact: true }).click();
      await capture("summary-before");
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Here's your rhythm/ })).toBeFocused();
      await expect(page.getByRole("heading", { name: "Create an account to save it" })).toBeVisible();
      await capture("summary-during");
      await expect.poll(() => page.getByRole("main").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      await capture("summary-after");
      expect(hydrationErrors).toEqual([]);
      if (reducedMotion === "reduce") {
        expect(await page.locator("main").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      }
    });
  }
}
