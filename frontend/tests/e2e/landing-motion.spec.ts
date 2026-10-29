import { expect, test } from "@playwright/test";
import { API, installApiMocks } from "./helpers";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`explores the sample rhythm at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      await installApiMocks(page);
      const apiRequests: string[] = [];
      page.on("request", request => {
        if (request.url().startsWith(API)) apiRequests.push(request.url());
      });
      await page.goto("/");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.getByRole("heading", { name: /Stop guessing/ })).toBeVisible();
      const coffee = page.getByRole("checkbox", { name: /Coffee around 9am/ });
      await expect(coffee).toBeChecked();
      const capture = async (frame: string) => {
        if (!process.env.CAPTURE_UI_MOTION || reducedMotion === "reduce") return;
        await page.screenshot({ path: `../docs/screenshots/ui-motion/landing/${width}/${frame}.png`, fullPage: true });
      };
      await coffee.focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("status")).toContainText("2 habits shown");
      await capture("before");
      await page.keyboard.press("Space");
      await expect(page.getByRole("status")).toContainText("3 habits shown");
      await capture("during");
      const ring = page.getByRole("img", { name: /Sleep from/ });
      await expect(ring).toHaveAccessibleName(/Coffee around 9am/);
      await expect.poll(() => page.getByRole("main").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      await capture("after");
      await expect(coffee).toBeFocused();
      await expect(page.getByText("A rhythm, shown with sample data. Yours is drawn from your own answers.")).toBeVisible();
      await page.getByRole("link", { name: "Run your first experiment" }).click();
      await expect(page.getByRole("heading", { name: /First, your rhythm/ })).toBeVisible();
      expect(apiRequests).toEqual([]);
    });
  }
}
