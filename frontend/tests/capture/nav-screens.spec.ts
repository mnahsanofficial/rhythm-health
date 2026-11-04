import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "../e2e/helpers";
import { profile, writtenLabReport } from "../support/fixtures";

/*
 * CAPTURE_PHASE=before|after npx playwright test -c tests/capture/playwright.config.mts
 * Mobile also needs MOBILE_URL: a fake-config `expo export --platform web` served by static-server.mjs.
 * Every call is mocked: no account, paid AI call or database write is involved.
 */
const phase = process.env.CAPTURE_PHASE ?? "after";
const out = `../docs/screenshots/landing-header-nav/${phase}`;
const QUESTION = "Does walking after dinner improve my sleep?";

type Shot = (name: string, prepare?: () => Promise<unknown>) => Promise<void>;
function shooter(page: Page, folder: string): Shot {
  mkdirSync(folder, { recursive: true });
  return async (name, prepare) => {
    try {
      await prepare?.();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${folder}/${name}.png` });
    } catch (cause) {
      console.warn(`skipped ${folder}/${name}: ${String(cause).split("\n")[0]}`);
    }
  };
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`web ${scheme} ${width}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const counts = await installApiMocks(page);
      await page.route("**/api/experiments/*/report", route => route.fulfill({ status: 200, json: writtenLabReport }));
      const shot = shooter(page, `${out}/web/${scheme}/${width}`);
      const hideBadge = () => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

      await shot("landing", async () => { await page.goto("/"); await hideBadge(); await page.getByRole("heading", { level: 1 }).waitFor(); await page.waitForTimeout(800); });
      await shot("landing-scrolled", () => page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5)));
      await shot("sign-in", async () => { await page.goto("/sign-in"); await hideBadge(); await page.getByRole("heading", { name: "Welcome back." }).waitFor(); });
      await shot("onboarding", async () => { await page.goto("/onboarding"); await hideBadge(); await page.getByRole("button", { name: "Start" }).waitFor(); });

      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      await shot("history", async () => { await page.goto("/history"); await hideBadge(); await page.getByRole("heading", { name: "Your experiment history" }).waitFor(); });
      await shot("demo", async () => { await page.goto("/demo"); await hideBadge(); await page.getByRole("heading", { name: "Explore a sample experiment." }).waitFor(); });
      await shot("ask", async () => { await page.goto("/experiments/new"); await hideBadge(); await page.getByRole("textbox").first().waitFor(); });
      await shot("proposal", async () => {
        await page.getByRole("textbox").first().fill(QUESTION);
        await page.getByRole("button", { name: "Design experiment" }).click();
        await page.getByRole("button", { name: /Start this experiment|Show prediction/ }).first().waitFor();
      });
      if (phase === "after") {
        await shot("leave-sheet", async () => { await page.getByRole("button", { name: "Close" }).click(); await page.getByRole("dialog").waitFor(); });
        await page.getByRole("button", { name: "Stay" }).click().catch(() => undefined);
      }
      await page.getByRole("button", { name: /Show prediction|Reveal/ }).click({ timeout: 2000 }).catch(() => undefined);
      await page.getByRole("button", { name: "Start this experiment" }).click().catch(() => undefined);
      await page.waitForTimeout(1000);
      const id = writtenLabReport.experiment.id;
      await shot("experiment", async () => { await page.goto(`/experiments/${id}`); await hideBadge(); await page.getByRole("link", { name: /Your lab/ }).first().waitFor(); });
      await shot("check-in", async () => { await page.goto(`/experiments/${id}/check-in`); await hideBadge(); await page.getByRole("heading").first().waitFor(); });
      await shot("report", async () => { await page.goto(`/experiments/${id}/report`); await hideBadge(); await page.getByRole("heading").first().waitFor(); });
    });
  }

  test(`mobile ${scheme} 390`, async ({ page }) => {
    const base = process.env.MOBILE_URL;
    test.skip(!base, "MOBILE_URL isn't set");
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await installApiMocks(page);
    await page.route("**/auth/v1/token**", route => route.fulfill({ status: 200, json: {
      access_token: "fake-e2e-access-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-e2e-refresh-token",
      user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-10-29T10:00:00Z" },
    } }));
    await page.route("**/api/profile", route => route.fulfill({ status: 200, json: profile }));
    await page.route("**/api/experiments/*/report", route => route.fulfill({ status: 200, json: writtenLabReport }));
    await page.route("**/api/experiments?status=completed", route => route.fulfill({ status: 200, json: [] }));
    const shot = shooter(page, `${out}/mobile/${scheme}/390`);
    const button = (name: string | RegExp) => page.getByRole("button", { name }).first();
    const menu = async (name: string) => { await button(/^Account menu/).click(); await button(name).click(); };

    await shot("landing", async () => { await page.goto(base!); await page.getByRole("heading", { name: "Stop guessing. Test one habit." }).first().waitFor(); });
    await shot("sign-in", async () => { await button("Sign in").click(); await page.getByLabel("Email").waitFor(); });
    await page.getByLabel("Email").fill("learner@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("fake-test-password");
    await page.getByTestId("submit-action").getByRole("button").click();
    await shot("lab-empty", () => page.getByRole("heading", { name: "Ask a question." }).waitFor());
    await shot("menu", () => button(/^Account menu/).click());
    await button("Close menu").click({ position: { x: 8, y: 800 } }).catch(() => undefined);
    await shot("history", async () => { await menu("History"); await page.getByRole("heading", { name: "Your experiment history" }).waitFor(); });
    await shot("demo", async () => { await menu("Demo"); await page.getByRole("heading", { name: "Explore a sample experiment." }).waitFor(); });
    await shot("settings", async () => { await menu("Daily reminders"); await page.getByRole("switch").first().waitFor(); });
    await shot("rhythm", async () => { await menu("Update your rhythm"); await page.getByText("Here's your rhythm.").waitFor(); });
    await menu("Your lab").catch(() => undefined);
    await page.getByRole("button", { name: "Cancel setup changes" }).click({ timeout: 1000 }).catch(() => undefined);
    await page.getByRole("heading", { name: "Ask a question." }).waitFor();
    await page.getByRole("textbox").first().fill(QUESTION);
    await shot("proposal", async () => { await button("Design experiment").click(); await button(/Start this experiment|Show prediction/).waitFor(); });
    if (phase === "after") {
      await shot("leave-sheet", async () => { await button("Close").click(); await button("Stay").waitFor(); });
      await button("Stay").click().catch(() => undefined);
    }
    await button("Show prediction").click({ timeout: 2000 }).catch(() => undefined);
    await button("Start this experiment").click();
    await shot("lab-active", () => page.getByText("Your experiment has started.").waitFor());
    await shot("experiment", async () => { await button(/See your experiment/).click(); await page.waitForTimeout(800); });
    await button(/Your lab/).click().catch(() => undefined);
    await shot("check-in", async () => { await button(/Check in/).click(); await page.getByRole("heading", { name: "Today's check-in." }).waitFor(); });
  });
}
