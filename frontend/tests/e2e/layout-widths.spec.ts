import { timelineFixture } from "../support/timeline-fixture";
import { expect, test, type Page } from "@playwright/test";
import type { Checkin, Experiment, LabReport } from "@/lib/types/api";
import { experiment, labReport } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

/** Every width the layout must hold at, plus 1280px and 1440px windows zoomed to 200%. */
const SCREENS = [
  { width: 320, height: 640, label: "320" },
  { width: 375, height: 812, label: "375" },
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
  { width: 1024, height: 768, label: "1024" },
  { width: 1280, height: 800, label: "1280" },
  { width: 1440, height: 900, label: "1440" },
  { width: 1920, height: 1080, label: "1920" },
  { width: 2560, height: 1440, label: "2560" },
  { width: 640, height: 400, label: "1280-at-200%" },
  { width: 720, height: 450, label: "1440-at-200%" },
];

/** The widest the shared page frame gets: 90rem of content plus 64px gutters. */
const FRAME_MAX = 1440 + 2 * 64;
/** Comfortable reading: no paragraph may hold more than this many characters per line. */
const MAX_LINE = 76;

type Problems = { overflow: number; offCentre: string[]; narrowFrame: string[]; longLines: string[]; overlaps: string[] };

async function measure(page: Page, wide: boolean): Promise<Problems> {
  return page.evaluate(({ wide, FRAME_MAX, MAX_LINE }) => {
    const vw = document.documentElement.clientWidth;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && el.closest("[aria-hidden=true]") === null;
    };
    const describe = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`;

    const header = document.querySelector("body > * header, header")!;
    const frames = [header, ...document.querySelector("main")!.children].filter(visible);
    const offCentre = frames
      .map(el => { const r = el.getBoundingClientRect(); return { el, gap: Math.abs(r.left - (vw - r.right)) }; })
      .filter(({ gap }) => gap > 2)
      .map(({ el, gap }) => `${describe(el)} off centre by ${Math.round(gap)}px`);

    const expected = Math.min(vw, FRAME_MAX);
    const framed = wide ? frames : [header];
    const narrowFrame = framed
      .filter(el => el.getBoundingClientRect().width < expected - 2)
      .map(el => `${describe(el)} is ${Math.round(el.getBoundingClientRect().width)}px, expected ${expected}px`);

    const canvas = document.createElement("canvas").getContext("2d")!;
    const longLines = [...document.querySelectorAll("main p")].filter(visible).flatMap(p => {
      const text = (p.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.length <= MAX_LINE) return [];
      const s = getComputedStyle(p);
      canvas.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const perChar = canvas.measureText(text).width / text.length;
      const capacity = p.getBoundingClientRect().width / perChar;
      return capacity > MAX_LINE ? [`${describe(p)} fits ${Math.round(capacity)} characters per line`] : [];
    });

    const items = [...document.querySelectorAll("header a, header button, main h1, main h2, main h3, main p, main a, main button, main input, main select, main textarea")]
      .filter(visible)
      .filter(el => !(el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")));
    // Phone action bars are pinned on purpose and content scrolls beneath them.
    const pinned = (el: Element) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (["sticky", "fixed"].includes(getComputedStyle(node).position)) return node;
      }
      return null;
    };
    const overlaps: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.contains(b) || b.contains(a) || pinned(a) !== pinned(b)) continue;
        // A control drawn inside the field it controls, like the password eye, is meant to overlap.
        if ((a.id && b.getAttribute("aria-controls") === a.id) || (b.id && a.getAttribute("aria-controls") === b.id)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 1 && y > 1) overlaps.push(`${describe(a)} overlaps ${describe(b)}`);
      }
    }

    return { overflow: document.documentElement.scrollWidth - vw, offCentre, narrowFrame, longLines, overlaps };
  }, { wide, FRAME_MAX, MAX_LINE });
}

async function check(page: Page, path: string, ready: RegExp | string, wide: boolean, label: string) {
  await page.goto(path);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
  await page.waitForTimeout(150);
  const problems = await measure(page, wide);
  expect.soft(problems.overflow, `${path} at ${label}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect.soft(problems.offCentre, `${path} at ${label}: stuck to one side`).toEqual([]);
  expect.soft(problems.narrowFrame, `${path} at ${label}: frame not using the width`).toEqual([]);
  expect.soft(problems.longLines, `${path} at ${label}: lines too long to read`).toEqual([]);
  expect.soft(problems.overlaps, `${path} at ${label}: overlapping elements`).toEqual([]);
  if (process.env.CAPTURE_LAYOUT) {
    const name = path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
    await page.screenshot({ path: `../docs/screenshots/layout/${label}/${name}.png`, fullPage: true });
  }
}

test.setTimeout(240_000);

test("public pages fill the screen and stay readable at every width", async ({ page }) => {
  await installApiMocks(page);
  for (const screen of SCREENS) {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await check(page, "/", /Stop guessing/, false, screen.label);
    await check(page, "/sign-in", /Sign in|Welcome back/, false, screen.label);
    await check(page, "/onboarding", /First, your rhythm/, true, screen.label);
  }
});

test("signed-in pages fill the screen and stay readable at every width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const counts = await installApiMocks(page);
  await answerOnboardingWithMouse(page);
  await createAccountAndSaveProfile(page, counts);

  const started = "2026-10-25T10:00:00Z";
  const active: Experiment = {
    ...experiment, status: "active", started_at: started,
    progress: {
      state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7,
      total_days: 10, days_remaining: 6, started_at: started, ends_at: "2026-11-04T10:00:00Z",
    },
  };
  const completedId = "55555555-5555-4555-8555-555555555555";
  const completed: Experiment = {
    ...experiment, id: completedId, status: "completed", started_at: "2026-10-10T10:00:00Z", completed_at: "2026-10-20T10:00:00Z",
    question: "Does stopping caffeine after 2 PM help me fall asleep faster?",
    progress: { ...active.progress, state: "completed", day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 },
  };
  const checkins: Checkin[] = [1, 2, 3].map(day => ({
    id: `day-${day}`, experiment_id: experiment.id, phase: "baseline", day_number: day, intervention_completed: false,
    metric_values: { morning_energy: 5 + day, sleep_quality: 6 }, note: "A quiet evening.",
    created_at: `2026-10-2${4 + day}T12:00:00Z`, updated_at: `2026-10-2${4 + day}T12:00:00Z`,
  }));
  const report: LabReport = {
    experiment: completed,
    analysis: {
    personal_guess: null,
      primary_metric: "morning_energy", success_criteria_percent: 10,
      adherence: {
        baseline_days_planned: 3, baseline_days_logged: 3, intervention_days_planned: 7, intervention_days_logged: 7,
        intervention_days_completed: 6, adherence_rate: 0.86, coverage_rate: 1, missing_days: [],
      },
      metrics: [], prediction: null,
      signal: { classification: "possible_signal", reasons: ["change_meets_success_criteria"], success_criteria_met: true, matches_predicted_direction: true },
    },
    narrative: null, chart: labReport.chart, created_at: "2026-10-20T10:00:00Z",
  };

  await page.route(`${API}/api/experiments?**`, route => {
    const status = new URL(route.request().url()).searchParams.get("status");
    return route.fulfill({ json: status === "active" ? [active] : status === "completed" ? [completed] : [active, completed] });
  });
  await page.route(`${API}/api/experiments/${experiment.id}`, route => route.fulfill({ json: active }));
  await page.route(`${API}/api/experiments/${experiment.id}/progress`, route => route.fulfill({
    json: timelineFixture(active, { recorded: [1, 2, 3], nextDayAt: "2026-10-29T10:00:00Z" }),
  }));
  await page.route(`${API}/api/experiments/${experiment.id}/checkins`, route => route.fulfill({ json: checkins }));
  await page.route(`${API}/api/experiments/${completedId}`, route => route.fulfill({ json: completed }));
  await page.route(`${API}/api/experiments/${completedId}/checkins`, route => route.fulfill({ json: [] }));
  await page.route(`${API}/api/experiments/${completedId}/report`, route => route.fulfill({ json: report }));

  for (const screen of SCREENS) {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await check(page, "/", experiment.question, true, screen.label);
    await check(page, "/experiments/new", "Ask a question.", true, screen.label);
    await check(page, `/experiments/${experiment.id}`, experiment.question, true, screen.label);
    await check(page, `/experiments/${experiment.id}/check-in`, /check-in/i, false, screen.label);
    await check(page, `/experiments/${completedId}/report`, completed.question, true, screen.label);
    await check(page, "/history", "Your experiment history", true, screen.label);
    await check(page, "/demo", /Explore a sample experiment/, false, screen.label);
  }
});
