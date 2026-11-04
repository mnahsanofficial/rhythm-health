import { THEMES } from "@rhythm-health/brand";
import { expect, test } from "@playwright/test";

const hexToRgb = (hex: string) => `rgb(${hex.slice(1).match(/../g)!.map(pair => parseInt(pair, 16)).join(", ")})`;
const pageBackground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

for (const width of [390, 1440]) {
  test.describe(`theme at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("follows a dark system from the first paint, with no hydration errors", async ({ page }) => {
      const problems: string[] = [];
      page.on("console", message => {
        if (message.type() === "error" && /hydrat/i.test(message.text())) problems.push(message.text());
      });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/sign-in");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect.poll(() => pageBackground(page)).toBe(hexToRgb(THEMES.dark.background));
      expect(problems).toEqual([]);
    });

    test("a choice overrides the system, survives a reload and can be undone", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/sign-in");
      await page.getByRole("button", { name: /^Theme:/ }).click();
      await page.getByRole("radio", { name: "Light" }).check();
      await expect.poll(() => pageBackground(page)).toBe(hexToRgb(THEMES.light.background));

      await page.reload();
      await expect.poll(() => pageBackground(page)).toBe(hexToRgb(THEMES.light.background));

      await page.getByRole("button", { name: "Theme: Light" }).click();
      await page.getByRole("radio", { name: "System" }).check();
      await expect.poll(() => pageBackground(page)).toBe(hexToRgb(THEMES.dark.background));
    });

    test("the landing illustration keeps its own colours in dark mode", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/");
      const sky = page.locator('[data-sky="day"]');
      await expect(sky).toBeAttached();
      await expect(sky).toHaveCSS("background-color", hexToRgb(THEMES.light.background));
      // The text on the illustration's light card must not inherit the dark page's light text.
      await expect(page.getByRole("heading", { name: /Stop guessing/ }).first()).toHaveCSS("color", hexToRgb(THEMES.light.text));
    });
  });
}
