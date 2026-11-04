import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { experiment, profile, proposeResponse, writtenLabReport } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";

/*
 * Screenshots of the phone app for pull requests, on Expo web at 390 wide, light and dark. Every call is mocked: no
 * account, paid AI call or database write. Expo web has no keyboard and no native picker, so those stay on the iPhone list.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://supabase.test.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=fake EXPO_PUBLIC_API_URL=http://api.test.invalid \
 *     npx expo export --platform web --output-dir /tmp/mobile-web        (in apps/mobile)
 *   MOBILE_BUILD=/tmp/mobile-web SHOTS=docs/screenshots/mobile-readability npx playwright test -c tests/capture/mobile.config.mts   (in frontend)
 */
const out = `../${process.env.SHOTS ?? "docs/screenshots/mobile-readability"}`;
const QUESTION = "Does walking after dinner improve my sleep?";
const running = { ...experiment, id: "running-id", status: "active", started_at: "2026-11-01T10:00:00Z", progress: { state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, total_days: 10, days_remaining: 6, started_at: "2026-11-01T10:00:00Z", ends_at: "2026-11-11T10:00:00Z" } };
const timeline = timelineFixture(running as never, { recorded: [1, 3], missed: [2], nextDayAt: "2026-11-05T10:00:00Z" });
const USER = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };

type State = { hasProfile: boolean; active: unknown[]; saved: boolean; blocked: string[] };
const APP = process.env.MOBILE_URL ?? "http://127.0.0.1:8092";
const savedAnswers = [{ id: "saved", experiment_id: "running-id", day_number: 4, phase: "intervention", metric_values: { morning_energy: 7, sleep_quality: 7 }, intervention_completed: false, note: null }];

/** Only the app's own origin reaches the network. Auth and API calls are answered here, whatever host the build points at, and anything else is refused. */
async function mocks(page: Page, state: State) {
  await page.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(APP).origin) return route.continue();
    const path = url.pathname + url.search;
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path.startsWith("/auth/v1/")) return json({ access_token: "fake-access-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh-token", user: USER });
    if (path === "/api/profile") {
      if (request.method() === "PUT") { state.hasProfile = true; return json(profile); }
      return state.hasProfile ? json(profile) : json({ detail: "Profile not found" }, 404);
    }
    if (path === "/api/experiments?status=active") return json(state.active);
    if (path === "/api/experiments?status=completed") return json([writtenLabReport.experiment]);
    if (path === "/api/experiments/propose") return json({ ...proposeResponse, personal_guess_available: true });
    if (path === "/api/experiments/calibration") return json({ points: [], trend: null, average_off_by_points: null, example: null, count: 0 });
    if (path.endsWith("/progress")) return json(state.saved ? timelineFixture(running as never, { recorded: [1, 3, 4], missed: [2], nextDayAt: "2026-11-05T10:00:00Z" }) : timeline);
    if (path.endsWith("/checkins")) {
      if (request.method() === "POST") { state.saved = true; return json(savedAnswers[0]); }
      return json(state.saved ? savedAnswers : []);
    }
    if (path.endsWith("/report")) return json(writtenLabReport);
    if (path.startsWith("/api/")) return json({ detail: "Not mocked" }, 404);
    state.blocked.push(url.host);
    return route.abort();
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`phone ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    const state: State = { hasProfile: false, active: [], saved: false, blocked: [] };
    await mocks(page, state);
    const folder = `${out}/${scheme}`;
    mkdirSync(folder, { recursive: true });
    const button = (name: string | RegExp) => page.getByRole("button", { name }).first();
    const tab = (name: string) => page.getByRole("tab", { name });
    const shot = async (name: string, prepare?: () => Promise<unknown>) => {
      await prepare?.();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${folder}/${name}.png` });
    };

    // In a development build on web, Expo's warning toast covers the page. It reports web-only warnings (BackHandler, SVG props).
    await page.addInitScript(() => addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = "#error-toast { display: none !important; }"; document.head.append(style); }));
    await page.goto(APP);
    await button("Sign in").click();
    await page.getByLabel("Email").fill("learner@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("fake-test-password");
    await page.getByTestId("submit-action").getByRole("button").click();

    await shot("01-setup-start", () => button("Start").waitFor());
    await button("Start").click();
    await shot("02-setup-age-disabled", () => page.getByText("Pick one to continue.").waitFor());
    await page.getByRole("radio", { name: "25–34" }).click();
    await button("Continue").click();
    await shot("03-setup-sleep-untouched", () => page.getByText("Pick both times to continue.").waitFor());
    // Expo web draws the browser's own time input here; the native time row is on the iPhone list.
    await page.locator('input[type="time"]').nth(0).fill("23:30");
    await page.locator('input[type="time"]').nth(1).fill("07:00");
    await button("Continue").click();
    await shot("04-setup-hours-stepper", () => page.getByRole("button", { name: "Half an hour more" }).waitFor());
    await button("Continue").click();
    await page.getByRole("radio", { name: /^Lightly active/ }).click();
    await button("Continue").click();
    await page.getByRole("checkbox", { name: "Better focus" }).click();
    await shot("05-setup-goals");
    await button("Continue").click();
    await button(/Skip|Continue/).click();
    await button(/Skip|Continue/).click();
    await shot("06-setup-review-rows", () => page.getByText("Here's your rhythm.").waitFor());
    await page.evaluate(() => { for (const node of document.querySelectorAll("div")) if (node.scrollHeight > node.clientHeight + 200) node.scrollTop = node.scrollHeight; });
    await shot("07-setup-review-rows-scrolled");
    await button("Save my rhythm").click();
    await shot("07a-guide-step-1", () => page.getByText("Example · Step 1 of 3").waitFor());
    await page.getByRole("radio", { name: "Yes, I made the change" }).click();
    await shot("07b-guide-step-2");
    await page.getByRole("radio", { name: "Morning energy: 7" }).click();
    await shot("07c-guide-step-3");
    await button("Save example").click();

    await shot("08-ask", () => page.getByRole("heading", { name: "Ask a question." }).waitFor());
    await page.getByRole("textbox").first().fill(QUESTION);
    await shot("09-ask-typed");
    await button("Design experiment").click();
    await shot("10-guess", () => button("Show prediction").waitFor());
    await button("Why?").click();
    await shot("11-guess-why");
    await page.getByRole("textbox").first().fill("10");
    await button("Show prediction").click();
    await shot("12-plan-summary", () => button("Start this experiment").waitFor());
    await button("Why?").click();
    await shot("13-plan-why");
    await button("Ask something else").click();

    await shot("14-you", () => tab("You").click());
    await shot("15-reminders", () => button("Daily reminders").click());
    await tab("You").click();
    await shot("16-example", () => button("See an example").click());
    await shot("17-history", () => tab("History").click());
    await shot("18-progress-empty", () => tab("Progress").click());

    state.active = [running];
    await page.reload();
    await button("Sign in").click();
    await page.getByLabel("Email").fill("learner@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("fake-test-password");
    await page.getByTestId("submit-action").getByRole("button").click();
    await shot("19-today-active", () => tab("Today").waitFor());
    await shot("20-progress-active", () => tab("Progress").click());
    await tab("Today").click();
    await shot("21-checkin", async () => { await button(/^Check in now/).click(); await button("Save check-in").waitFor(); });
    await page.setViewportSize({ width: 320, height: 640 });
    await shot("22-checkin-320");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("radio", { name: "Not today" }).click();
    for (const metric of proposeResponse.proposal!.metrics) await page.getByRole("radio", { name: `${metric.label}: 7` }).click();
    await shot("23-checkin-answered");
    await button("Save check-in").click();
    await button("Continue").waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${folder}/24-celebration-after-save.png` });
    // react-native-web reports a screen reader as on, so here the celebration waits for a tap, as it does with VoiceOver.
    await button("Continue").click();
    await shot("25-today-after-save", () => button("Edit answers").waitFor());
    await button("Edit answers").click();
    await button("Update check-in").waitFor();
    await page.getByRole("radio", { name: "Morning energy: 8" }).click();
    await shot("26-checkin-updating");
    await button("Update check-in").click();
    await button("Continue").waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${folder}/27-celebration-after-update.png` });
    await button("Continue").click();
    await shot("28-today-after-update", () => button("Edit answers").waitFor());
    console.log(`refused hosts: ${state.blocked.length ? [...new Set(state.blocked)].join(", ") : "none"}`);
  });
}
