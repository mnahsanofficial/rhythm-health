import { expect, test } from "@playwright/test";
import type { Experiment } from "@/lib/types/api";
import { experiment, proposeResponse } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 768, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`ask from Your lab at ${width}px with motion ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const counts = await installApiMocks(page);
      await answerOnboardingWithMouse(page);
      await createAccountAndSaveProfile(page, counts);
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const field = page.getByRole("textbox", { name: "Your question or goal" });
      const submit = page.getByRole("button", { name: "Design my experiment" });
      await expect(field).toBeVisible();
      await expect(page.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
      await expect(submit).toBeDisabled();
      await field.fill("abcd");
      await expect(submit).toBeDisabled();
      await expect(page.getByText("4/500", { exact: true })).toBeVisible();
      await field.fill("x".repeat(500));
      await expect(page.getByText("500/500", { exact: true })).toBeVisible();
      await expect(submit).toBeEnabled();
      await field.fill("Does an evening walk help my sleep?");

      const capture = async (name: string) => {
        if (!process.env.CAPTURE_LAB_ASK || reducedMotion === "reduce") return;
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `../docs/screenshots/lab-ask-question/${width}/${name}.png`, fullPage: true });
      };
      await capture("no-experiment");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let calls = 0;
      await page.route(`${API}/api/experiments/propose`, async route => {
        calls += 1;
        if (calls === 1) {
          await gate;
          await route.fulfill({ status: 503, json: { detail: "AI service unavailable" } });
          return;
        }
        await route.fulfill({ json: proposeResponse });
      });
      await submit.click();
      await expect(page.getByRole("region", { name: "Preparing your experiment" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Shaping your experiment…" })).toBeDisabled();
      release();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("The service is unavailable right now.");
      await expect(field).toHaveValue("Does an evening walk help my sleep?");
      await page.getByRole("button", { name: "Retry" }).click();
      const preview = page.getByRole("region", { name: "Experiment and prediction preview" });
      await expect(preview).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      await expect(preview.getByRole("heading", { level: 1 })).toHaveText(experiment.question);
      await expect(preview.getByText("+8% to +15%", { exact: true })).toHaveCSS("opacity", "1");
      if (reducedMotion === "reduce") {
        expect(await preview.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
      }
      await capture("preview");
      await page.getByRole("button", { name: "Start this experiment" }).click();
      await expect(page).toHaveURL(new RegExp(`/experiments/${experiment.id}$`));
      await expect(page.getByRole("heading", { name: experiment.question })).toBeVisible();
      expect(counts.saves).toBe(1);
      expect(counts.starts).toBe(1);
      expect(calls).toBe(2); // Two intercepted fake responses, never paid calls.
      await page.goto("/");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.getByText("Day 1 of 10", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Check in for day 1" })).toBeVisible();
      const toggle = page.getByRole("button", { name: "Test another habit" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect((await toggle.boundingBox())!.y).toBeLessThan((await page.getByRole("heading", { name: experiment.question }).boundingBox())!.y);
      await capture("active-lab");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(field).toBeFocused();
      await expect(page.getByRole("heading", { name: experiment.question })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: "See your experiment" })).toHaveCount(0);
      await expect(page.getByText("Start with a hunch", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("alert")).toContainText("You already have an active experiment.");
      await expect(page.getByRole("link", { name: "Check in for day 1" })).toBeVisible();
      await field.fill("Does less caffeine improve my focus?");
      await expect(submit).toBeDisabled();
      await capture("active-question");
      expect(calls).toBe(2);
      await page.getByRole("button", { name: "Close question" }).click();
      await expect(toggle).toBeFocused();
      await expect(page.getByRole("heading", { name: experiment.question })).toBeVisible();
      await expect(page.getByRole("link", { name: "See your experiment" })).toBeVisible();
      await toggle.click();
      await expect(field).toHaveValue("Does less caffeine improve my focus?");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(counts.proposals).toBe(0); // Proposal requests above are overridden and intercepted.
      expect(errors).toEqual([]);
    });
  }
}

// An active experiment created elsewhere after the initial home load must still block the paid request.
test("home catches an active experiment started in another tab", async ({ page }) => {
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.goto("/");
  const field = page.getByRole("textbox", { name: "Your question or goal" });
  await expect(field).toBeVisible();
  const active: Experiment = { ...experiment, status: "active" };
  await page.route(`${API}/api/experiments?status=active`, route => route.fulfill({ json: [active] }));
  await field.fill("Does less caffeine improve my focus?");
  await page.getByRole("button", { name: "Design my experiment" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("You already have an active experiment.");
  await expect(page.getByRole("link", { name: "Go to your active experiment" })).toHaveAttribute("href", `/experiments/${experiment.id}`);
  expect(counts.proposals).toBe(0);
  expect(counts.saves).toBe(0);
});
