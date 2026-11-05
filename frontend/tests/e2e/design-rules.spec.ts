import { THEMES } from "@rhythm-health/brand";
import { expect, test, type Page } from "@playwright/test";
import type { Experiment, LabReport } from "@/lib/types/api";
import { timelineFixture } from "../support/timeline-fixture";
import { experiment, labReport } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

/** The rules from docs/design/05-design-system.md, measured on the demo path. */
const BUTTON_MAX = 320;
const MIN_HEIGHT = 48;

type Measured = {
  filled: { name: string; width: number; height: number; pinned: boolean; submit: boolean }[];
  fields: { name: string; border: string }[];
};

async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
    const probe = document.createElement("span");
    probe.style.color = accent;
    document.body.append(probe);
    const accentRgb = getComputedStyle(probe).color;
    probe.remove();
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[hidden]") && !el.closest("[aria-hidden=true]");
    };
    const pinned = (el: Element) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (["sticky", "fixed"].includes(getComputedStyle(node).position)) return true;
      }
      return false;
    };
    return {
      filled: [...document.querySelectorAll("main button, main a[href]")].filter(shown)
        .filter(el => getComputedStyle(el).backgroundColor === accentRgb)
        .map(el => {
          const r = el.getBoundingClientRect();
          return { name: (el.textContent ?? "").trim().slice(0, 40), width: r.width, height: r.height, pinned: pinned(el), submit: el.matches("form button[type=submit]") };
        }),
      fields: [...document.querySelectorAll("main input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=hidden]), main textarea, main select")].filter(shown)
        .map(el => ({ name: el.getAttribute("name") ?? el.id, border: getComputedStyle(el).borderTopColor })),
    };
  });
}

const rgb = (hex: string) => `rgb(${hex.slice(1).match(/../g)!.map(pair => parseInt(pair, 16)).join(", ")})`;

async function expectRules(page: Page, screen: string, width: number, mode: "light" | "dark", maxPrimaries = 1) {
  await page.waitForTimeout(450);
  const { filled, fields } = await measure(page);
  expect.soft(filled.length, `${screen} at ${width} ${mode}: filled primaries ${filled.map(f => f.name)}`).toBeLessThanOrEqual(maxPrimaries);
  for (const button of filled) {
    expect.soft(button.height, `${screen}: "${button.name}" height`).toBeGreaterThanOrEqual(MIN_HEIGHT);
    if (width > 640) {
      expect.soft(button.width, `${screen}: "${button.name}" fits its words on wide screens`).toBeLessThanOrEqual(BUTTON_MAX);
    } else if (!button.pinned && !button.submit) { // A form's submit lines up with its fields on phones.
      expect.soft(button.width, `${screen}: "${button.name}" is full width without being pinned`).toBeLessThanOrEqual(BUTTON_MAX);
    }
  }
  for (const field of fields) {
    expect.soft(field.border, `${screen}: field ${field.name} edge`).toBe(rgb(THEMES[mode].control));
  }
}

const started = "2026-10-25T10:00:00Z";
const active: Experiment = {
  ...experiment, status: "active", started_at: started,
  progress: { state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, total_days: 10, days_remaining: 6, started_at: started, ends_at: "2026-11-04T10:00:00Z" },
};
const completedId = "55555555-5555-4555-8555-555555555555";
const completed: Experiment = { ...experiment, id: completedId, status: "completed", completed_at: "2026-10-20T10:00:00Z", started_at: "2026-10-10T10:00:00Z", progress: { ...active.progress, state: "completed", day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } };
const report: LabReport = { ...labReport, experiment: completed };

test.setTimeout(120_000);

for (const mode of ["light", "dark"] as const) for (const width of [390, 1440]) {
  test(`demo path keeps the button and field rules at ${width}px in ${mode}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode });
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);

    await page.goto("/");
    await page.getByRole("heading", { name: /Stop guessing/ }).first().waitFor();
    await expectRules(page, "landing", width, mode, 3); // The story's start and end, and the page's end: screens apart.

    await page.goto("/sign-in");
    await page.getByRole("heading").first().waitFor();
    await expectRules(page, "sign-in", width, mode);

    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("heading", { name: "How old are you?" }).waitFor();
    await expectRules(page, "onboarding step", width, mode);

    await page.evaluate(() => localStorage.clear());
    await answerOnboardingWithMouse(page);
    await expectRules(page, "onboarding summary", width, mode);
    await createAccountAndSaveProfile(page, counts);

    await page.route(`${API}/api/experiments?**`, route => {
      const status = new URL(route.request().url()).searchParams.get("status");
      return route.fulfill({ json: status === "active" ? [active] : status === "completed" ? [completed] : [active, completed] });
    });
    await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
    await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({ json: timelineFixture(active, { recorded: [1, 2, 3], nextDayAt: "2026-10-29T10:00:00Z" }) }));
    await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: [] }));
    await page.route(`${API}/api/experiments/${completedId}/report`, route => route.fulfill({ json: report }));

    for (const [screen, path, heading] of [
      ["Today", "/", "Evening walk"],
      ["ask a question", "/experiments/new", "Ask a question."],
      ["check-in", `/experiments/${experiment.id}/check-in`, /check-in/i],
      ["Lab Report", `/experiments/${completedId}/report`, experiment.question],
    ] as const) {
      await page.goto(path);
      await page.getByRole("heading", { name: heading }).first().waitFor();
      await expectRules(page, screen, width, mode);
    }
  });
}

test("the sign-in button lines up with its fields on a phone, and fits its words on a wide screen", async ({ page }) => {
  await installApiMocks(page);
  for (const [width, matches] of [[390, true], [1440, false]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/sign-in");
    const field = (await page.getByLabel("Email", { exact: true }).boundingBox())!;
    const submit = (await page.getByRole("button", { name: "Sign in", exact: true }).boundingBox())!;
    if (matches) expect(submit.width).toBeCloseTo(field.width, 0);
    else expect(submit.width).toBeLessThanOrEqual(BUTTON_MAX);
  }
});

test("the Lab Report's next step moves from revealing to writing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.route(`${API}/api/experiments/${completedId}/report`, route => route.fulfill({ json: { ...report, narrative: null } }));
  await page.goto(`/experiments/${completedId}/report`);
  await page.getByRole("button", { name: "Reveal my result" }).waitFor();
  expect((await measure(page)).filled.map(f => f.name)).toEqual(["Reveal my result"]);
  await page.getByRole("button", { name: "Reveal my result" }).click();
  await page.mouse.move(0, 0); // Hover changes the fill this measures.
  await page.waitForTimeout(300);
  expect((await measure(page)).filled.map(f => f.name)).toEqual(["Write my report"]);
});

test("onboarding names the steps and doesn't offer Skip on a required one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("heading", { name: "How old are you?" }).waitFor();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  const rail = page.getByRole("list", { name: "Setup steps" });
  await expect(rail.getByRole("listitem")).toHaveText(["Age", "Sleep", "Hours", "Move", "Goals", "Habits", "Limits"]);
  await expect(rail.locator('[aria-current="step"]')).toHaveText("Age");
});

test("the panel takes shape as answers arrive", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Start" }).click();
  const panel = page.getByRole("complementary", { name: "Your rhythm so far" });
  await expect(panel.getByText("Lightly active")).toHaveCount(0);
  await page.getByText("25–34", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Bedtime").fill("22:30");
  await page.getByLabel("Wake time").fill("06:30");
  await expect(panel.getByText("22:30 to 06:30")).toBeVisible();
});

test("suggestions sit under the question field and fill it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.goto("/experiments/new");
  const field = page.getByLabel("Your question or goal");
  const chips = page.getByRole("group", { name: "Suggestions" }).getByRole("button");
  await expect(chips.first()).toBeVisible();
  const [fieldBox, chipBox] = [await field.boundingBox(), await chips.first().boundingBox()];
  expect(chipBox!.y).toBeGreaterThan(fieldBox!.y + fieldBox!.height);
  const words = (await chips.first().textContent())!.trim();
  await chips.first().click();
  await expect(field).toHaveValue(words);
});

test("the other screens keep the same button edges, and no banned words", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);
  await page.route(`${API}/api/experiments?**`, route => route.fulfill({ json: [] }));
  for (const [path, heading] of [["/demo", /Explore a sample experiment/], ["/history", "Your experiment history"]] as const) {
    await page.goto(path);
    await page.getByRole("heading", { name: heading }).first().waitFor();
    await page.waitForTimeout(450);
    const faint = await page.evaluate(line => [...document.querySelectorAll("main button, main a[href]")]
      .filter(el => parseFloat(getComputedStyle(el).borderTopWidth) > 0 && getComputedStyle(el).borderTopColor === line)
      .map(el => el.textContent), rgb(THEMES.light.border));
    expect.soft(faint, `${path}: buttons with a divider's edge`).toEqual([]);
    await expect.soft(page.locator("main")).not.toContainText(/discover|unlock|journey/i);
  }
});
