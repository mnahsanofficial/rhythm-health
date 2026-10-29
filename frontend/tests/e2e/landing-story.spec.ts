import { expect, test, type Page } from "@playwright/test";
import { API, installApiMocks } from "./helpers";

const SCENES = [
  "Your sleep is the experiment.",
  "Check in in about 30 seconds.",
  "The prediction comes first.",
  "Late coffee, or none after 2 PM?",
  "Does a walk after dinner help you sleep?",
  "Tomorrow is day 4.",
];

const nightOpacity = (page: Page) =>
  page.locator('[data-sky="night"]').evaluate(el => Number(getComputedStyle(el).opacity));

async function open(page: Page, width: number, reducedMotion: "reduce" | "no-preference") {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion });
  const problems: string[] = [];
  page.on("console", message => {
    if (/hydration|didn't match|did not match/i.test(message.text())) problems.push(message.text());
  });
  page.on("pageerror", error => problems.push(error.message));
  await installApiMocks(page);
  const apiRequests: string[] = [];
  page.on("request", request => { if (request.url().startsWith(API)) apiRequests.push(request.url()); });
  await page.goto("/");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { level: 1, name: /Stop guessing/ })).toBeVisible();
  return { problems, apiRequests };
}

async function scrollToHeading(page: Page, name: string) {
  await page.getByRole("heading", { level: 2, name }).evaluate(el => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

const capture = async (page: Page, width: number, frame: string) => {
  if (!process.env.CAPTURE_LANDING) return;
  await page.screenshot({ path: `../docs/screenshots/landing-day/${width}/${frame}.png` });
};

for (const width of [320, 390, 1440]) {
  test(`the day turns with scroll and loops back to night at ${width}px`, async ({ page }) => {
    const { problems, apiRequests } = await open(page, width, "no-preference");
    await expect(page.locator("[data-story-stage]")).toBeVisible();
    expect(await nightOpacity(page)).toBeGreaterThan(0.9);
    await capture(page, width, "0-intro");

    for (const [i, name] of SCENES.entries()) {
      await scrollToHeading(page, name);
      await expect(page.getByRole("heading", { level: 2, name })).toBeInViewport();
      await noHorizontalScroll(page);
      await capture(page, width, `${i + 1}-${name.split(" ").slice(0, 3).join("-").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`);
      if (name === "The prediction comes first.") {
        expect(await nightOpacity(page)).toBeLessThan(0.1);
        await expect(page.locator('[data-scene="office"]')).toHaveCount(1);
        await expect(page.locator('[data-scene="bedroom"]')).toHaveCount(0);
      }
    }
    // The last frame is night again, the same as the first.
    expect(await nightOpacity(page)).toBeGreaterThan(0.9);
    await expect(page.locator('[data-scene="bedroom"]')).toHaveCount(1);

    // Scrolling is never hijacked: the page stays where it is put, every step of the story.
    const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (const share of [0.12, 0.2, 0.33, 0.45, 0.6, 0.72]) {
      const target = Math.round(height * share);
      await page.evaluate(y => window.scrollTo(0, y), target);
      await page.waitForTimeout(500);
      expect(Math.abs(await page.evaluate(() => window.scrollY) - target), `scroll held at ${target}`).toBeLessThanOrEqual(1);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    const cta = page.getByRole("link", { name: "Run your first experiment" }).last();
    await expect(cta).toBeInViewport();
    await capture(page, width, "7-end");

    expect(problems).toEqual([]);
    expect(apiRequests).toEqual([]);
    await cta.click();
    await expect(page.getByRole("heading", { name: /First, your rhythm/ })).toBeVisible();
  });

  test(`reduced motion shows the five scenes as stills at ${width}px`, async ({ page }) => {
    const { problems } = await open(page, width, "reduce");
    await expect(page.locator("[data-story-stage]")).toBeHidden();
    const stills = page.getByRole("img", { name: /^Illustration:/ });
    await expect(stills).toHaveCount(5);
    for (const name of SCENES) {
      await scrollToHeading(page, name);
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
      await noHorizontalScroll(page);
    }
    for (let i = 0; i < 5; i++) await expect(stills.nth(i)).toBeVisible();
    const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length);
    expect(running).toBe(0);
    if (process.env.CAPTURE_LANDING) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `../docs/screenshots/landing-day/${width}/reduced-motion.png`, fullPage: true });
    }
    expect(problems).toEqual([]);
  });
}
