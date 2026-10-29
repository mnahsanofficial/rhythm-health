import { expect, test, type Page } from "@playwright/test";
import { answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

async function expectPinned(page: Page) {
  await page.evaluate(() => window.scrollTo(0, Math.round(document.documentElement.scrollHeight / 2)));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const box = (await page.getByRole("banner").boundingBox())!;
  expect(box.y).toBe(0);
  await expect(page.getByRole("link", { name: "Rhythm" })).toBeInViewport();
}

for (const width of [320, 390, 1440]) {
  test(`the header stays at the top while scrolling and gives signed-in people a full nav at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const counts = await installApiMocks(page);
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expectPinned(page);
    // The story's scene starts below the header rather than underneath it.
    const header = (await page.getByRole("banner").boundingBox())!;
    const stage = (await page.locator("[data-story-stage]").boundingBox())!;
    expect(stage.y).toBeGreaterThanOrEqual(header.y + header.height - 1);

    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    const main = page.getByRole("navigation", { name: "Main" });
    const account = page.getByRole("button", { name: /Account menu for/ });
    await expect(account).toBeVisible();
    const accountBox = (await account.boundingBox())!;
    expect(accountBox.width).toBeGreaterThanOrEqual(44);
    expect(accountBox.height).toBeGreaterThanOrEqual(44);

    if (width >= 768) {
      await expect(main.getByRole("link", { name: "Your lab" })).toBeVisible();
      await expect(main.getByRole("link", { name: "Your lab" })).toHaveAttribute("aria-current", "page");
    } else {
      // Phones keep the bar to the logo and one button; the sections live in the panel.
      await expect(main).toBeHidden();
    }

    await account.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(`#${await account.getAttribute("aria-controls")}`);
    await expect(panel.getByText("learner@example.invalid")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();
    if (width < 768) await expect(panel.getByRole("link", { name: "History" })).toBeVisible();
    if (process.env.CAPTURE_HEADER) await page.screenshot({ path: `../docs/screenshots/header/${width}-menu-open.png` });
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(account).toBeFocused();

    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Your experiment history" })).toBeVisible();
    if (process.env.CAPTURE_HEADER) await page.screenshot({ path: `../docs/screenshots/header/${width}-signed-in.png` });
  });
}
