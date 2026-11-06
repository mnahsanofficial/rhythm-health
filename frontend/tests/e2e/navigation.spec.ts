import { THEMES } from "@rhythm-health/brand";
import { expect, test, type Page } from "@playwright/test";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks, type E2eCounts } from "./helpers";
import { experiment, writtenLabReport } from "../support/fixtures";

const QUESTION = "Does walking after dinner improve my sleep?";
const hideBadge = (page: Page) => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

function failOnBrowserDialogs(page: Page) {
  page.on("dialog", dialog => { throw new Error(`A browser dialog opened: ${dialog.message()}`); });
}

async function signedIn(page: Page): Promise<E2eCounts> {
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  return counts;
}

/** Sign in, land on a page, then go to the flow from there the way a person does. */
async function openAskFrom(page: Page, from: string) {
  await page.goto(from);
  await hideBadge(page);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/experiments/new";
    link.id = "go-to-ask";
    document.body.prepend(link);
  });
  await page.evaluate(() => (window as unknown as { next: { router: { push(path: string): void } } }).next.router.push("/experiments/new"));
  await page.getByLabel(/question or goal/i).waitFor();
}

const relativeLuminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const parse = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const hex = (value: string) => value.slice(1).match(/../g)!.map(pair => parseInt(pair, 16));
const colorOf = (page: Page, name: string) => page.getByRole("banner").getByRole("link", { name, exact: true }).evaluate(el => getComputedStyle(el).color);

test.describe("landing header", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`is clear over the night sky, then solid with a hairline once scrolled, and passes contrast in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1440, height: 900 });
      await installApiMocks(page);
      await page.goto("/");
      await hideBadge(page);
      const header = page.getByRole("banner");
      await expect(header).toHaveAttribute("data-over-hero", "true");
      await expect(header.getByRole("link", { name: "Rhythm, home" })).toBeVisible();

      // The scene runs under the header: the story's stage starts at the very top.
      expect((await page.locator("[data-story-stage]").boundingBox())!.y).toBeLessThanOrEqual(0);
      const signIn = header.getByRole("link", { name: "Sign in", exact: true });
      const start = header.getByRole("link", { name: "Start an experiment", exact: true });
      await expect(signIn).toBeVisible();
      await expect(start).toBeVisible();
      expect(contrast(parse(await colorOf(page, "Sign in")), hex("#263a6b"))).toBeGreaterThanOrEqual(4.5);
      const startOver = await start.evaluate(el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
      expect(contrast(parse(startOver[0]), parse(startOver[1]))).toBeGreaterThanOrEqual(4.5);
      // Only one filled button shows: the hero's own button steps aside at this width.
      await expect(page.locator("main section").first().getByRole("link", { name: "Start an experiment", exact: true })).toHaveCount(0);

      await page.evaluate(() => window.scrollTo(0, 200));
      await expect(header).toHaveAttribute("data-over-hero", "false");
      const background = THEMES[scheme].background;
      await expect.poll(() => header.locator("[data-header-solid]").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
      expect(contrast(parse(await colorOf(page, "Sign in")), hex(background))).toBeGreaterThanOrEqual(4.5);
      const borderWidth = await header.locator("[data-header-solid]").evaluate(el => getComputedStyle(el).borderBottomWidth);
      expect(borderWidth).toBe("1px");
      const startSolid = await start.evaluate(el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
      expect(contrast(parse(startSolid[0]), parse(startSolid[1]))).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const width of [320, 390]) {
    test(`fits at ${width}px with the logo and sign in, and the hero keeps the main button`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await installApiMocks(page);
      await page.goto("/");
      await hideBadge(page);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      await expect(header.getByRole("link", { name: "Start an experiment", exact: true })).toBeHidden();
      await expect(page.locator("main").getByRole("link", { name: "Start an experiment", exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("with reduced motion there's no sky, so the header is solid from the start", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installApiMocks(page);
    await page.goto("/");
    await expect(page.getByRole("banner")).toHaveAttribute("data-over-hero", "false");
  });
});

test.describe("the logo", () => {
  test("goes to the landing page signed out and your lab signed in", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const counts = await installApiMocks(page);
    await page.goto("/demo");
    await hideBadge(page);
    await page.getByRole("link", { name: "Rhythm, home" }).click();
    await expect(page.getByRole("heading", { name: /Stop guessing/ })).toBeVisible();
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);
    await page.goto("/history");
    await hideBadge(page);
    await page.getByRole("link", { name: "Rhythm, home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("banner")).toHaveAttribute("data-over-hero", "false");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Your lab" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("main sections and detail pages", () => {
  test("main sections have no back link, and a detail page has one that names where it goes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page);
    await page.route(`${API}/api/experiments/*/report`, route => route.fulfill({ json: writtenLabReport }));
    for (const path of ["/history", "/demo"]) {
      await page.goto(path);
      await hideBadge(page);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await expect(page.locator("main").getByRole("link", { name: /Back to|←|‹/ })).toHaveCount(0);
    }
    await page.goto(`/experiments/${experiment.id}/report`);
    await hideBadge(page);
    const back = page.locator("main").getByRole("link", { name: /^Back to / }).first();
    await expect(back).toHaveText(/^‹ /);
    const box = (await back.boundingBox())!;
    expect(box.x).toBeLessThan(40);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("flows close with one ×", () => {
  test("sign in closes to where you came from, and with the browser's back button too", async ({ page }) => {
    failOnBrowserDialogs(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await installApiMocks(page);
    await page.goto("/demo");
    await hideBadge(page);
    await page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    const close = page.getByRole("banner").getByRole("button", { name: "Close" });
    const box = (await close.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(390 - 40);
    expect(box.width).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(page).toHaveURL(/\/demo$/);
    await page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goBack();
    await expect(page).toHaveURL(/\/demo$/);
  });

  test("opened directly, a flow closes to its home", async ({ page }) => {
    await installApiMocks(page);
    await page.goto("/sign-in");
    await hideBadge(page);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("nothing typed, the question closes straight away", async ({ page }) => {
    failOnBrowserDialogs(page);
    await signedIn(page);
    await openAskFrom(page, "/history");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("typed words ask first: Stay keeps them, and Leave goes back", async ({ page }) => {
    failOnBrowserDialogs(page);
    const counts = await signedIn(page);
    await openAskFrom(page, "/history");
    const field = page.getByLabel(/question or goal/i);
    await field.fill(QUESTION);
    await page.getByRole("button", { name: "Close" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Leave without saving?" })).toBeVisible();
    await expect(sheet).toContainText("Your question won't be kept.");
    await sheet.getByRole("button", { name: "Stay" }).click();
    await expect(sheet).toBeHidden();
    await expect(field).toHaveValue(QUESTION);
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/history$/);
    expect(counts.proposals).toBe(0);
  });

  test("a paid proposal is protected from ×, the browser's back button and the logo, and closing never pays again", async ({ page }) => {
    failOnBrowserDialogs(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const counts = await signedIn(page);
    await openAskFrom(page, "/history");
    await page.getByLabel(/question or goal/i).fill(QUESTION);
    await page.getByRole("button", { name: "Design experiment" }).click();
    await page.getByRole("button", { name: /Start this experiment|Show prediction|Reveal|Next/ }).first().waitFor();
    expect(counts.proposals).toBe(1);

    const sheet = page.getByRole("dialog");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toContainText("Your proposal won't be kept.");
    await sheet.getByRole("button", { name: "Stay" }).click();
    await expect(sheet).toBeHidden();

    // The browser's back button shows the same sheet, without leaving the page.
    await page.goBack();
    await expect(sheet).toContainText("Your proposal won't be kept.");
    await expect(page).toHaveURL(/\/experiments\/new/);
    await sheet.getByRole("button", { name: "Stay" }).click();
    await expect(page.getByRole("button", { name: /Start this experiment|Show prediction|Reveal|Next/ }).first()).toBeVisible();

    await page.getByRole("link", { name: "Rhythm, home" }).click();
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/experiments\/new/);
    await sheet.getByRole("button", { name: "Stay" }).click();

    await page.goBack();
    await sheet.getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/history$/);
    expect(counts.proposals).toBe(1);
    expect(counts.saves).toBe(0);
  });

  test("answers typed into the check-in ask first, and untouched ones don't", async ({ page }) => {
    failOnBrowserDialogs(page);
    await signedIn(page);
    await openAskFrom(page, "/history");
    await page.getByLabel(/question or goal/i).fill(QUESTION);
    await page.getByRole("button", { name: "Design experiment" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Start this experiment" }).click();
    await page.waitForURL(/\/experiments\/[^/]+$|\/$/);
    await page.goto(`/experiments/${experiment.id}/check-in`);
    await hideBadge(page);
    await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("radio").first().check({ force: true });
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toContainText("Your answers won't be kept.");
    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(new RegExp(`/experiments/${experiment.id}$`));
  });

  test("the sheet holds keyboard focus, closes on Escape and returns focus to the ×", async ({ page }) => {
    await signedIn(page);
    await openAskFrom(page, "/history");
    await page.getByLabel(/question or goal/i).fill(QUESTION);
    const close = page.getByRole("button", { name: "Close" });
    await close.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: "Stay" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(close).toBeFocused();
  });

  test("onboarding keeps its answers on the device, so × doesn't ask, and steps go by Previous", async ({ page }) => {
    failOnBrowserDialogs(page);
    await installApiMocks(page);
    await page.goto("/");
    await hideBadge(page);
    await page.getByRole("banner").getByRole("link", { name: "Rhythm, home" }).waitFor();
    await page.goto("/onboarding");
    await hideBadge(page);
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByText("25–34", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByRole("heading", { name: "How old are you?" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });
});
