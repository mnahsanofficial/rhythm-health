/* Expo-web evidence for the 5 Nov feedback PRs. Every external request is intercepted: no account, AI call or database.
 *
 * In apps/mobile:
 *   EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://supabase.test.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=fake-public-anon-key \
 *     EXPO_PUBLIC_API_URL=http://api.test.invalid:8001 npx expo export --platform web --output-dir "$BUILD"
 *   node ../../frontend/tests/capture/static-server.mjs "$BUILD" 8096 &
 *   node scripts/capture-feedback.cjs checkin          (a scene group below)
 */
/* global __dirname */
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'docs/screenshots/mobile-feedback-5-nov');
const base = 'http://127.0.0.1:8096';
const API = 'http://api.test.invalid:8001';
function load(relative) {
  const file = path.join(root, relative);
  const mod = new Module(file);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
const { experiment, profile, labReport, writtenLabReport, proposeResponse } = load('frontend/tests/support/fixtures.ts');
const { timelineFixture } = load('frontend/tests/support/timeline-fixture.ts');
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: profile.id, exp: 2100000000, iat: 1793850000, role: 'authenticated' }), 'fake'].join('.');
const user = { id: profile.id, email: 'example@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' };

const on = (day, phase, extra = {}) => ({ ...experiment, status: 'active', ...extra, progress: { ...experiment.progress, state: 'in_progress', day_number: day, total_days: 10, days_remaining: 10 - day, phase, phase_day: phase === 'baseline' ? day : day - 3, phase_days: phase === 'baseline' ? 3 : 7, started_at: '2026-11-01T09:00:00Z' } });
const second = on(5, 'intervention', { id: 'second-id', question: 'Does less caffeine after lunch improve my focus at work?' });
const scale = { type: 'scale', min: 1, max: 10, primary: false, min_label: null, max_label: null };
const today = (list) => ({ revision: 'r', note: null, all_recorded: false,
  experiments: list.map((item, index) => ({ id: item.id, question: item.question, action: index ? 'No caffeine after lunch' : 'Walk for 20 minutes', timing: 'After lunch', day_number: item.progress.day_number, total_days: 10, phase: item.progress.phase, change_required: item.progress.phase === 'intervention', change_made: null, recorded: false })),
  questions: [
    { id: 'q1', experiment_ids: list.map(item => item.id), value: null, metric: { key: 'energy', label: 'Morning energy', ...scale } },
    { id: 'q2', experiment_ids: [list[list.length - 1].id], value: null, metric: { key: 'focus', label: 'Focus', ...scale } },
  ] });

async function open(browser, { mode, list, recorded = [], reducedMotion = 'no-preference' }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Dhaka', colorScheme: mode, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /same key|unique.*key/i.test(message.text())) errors.push(message.text()); });
  const checkins = recorded.map(day => ({ id: `c${day}`, experiment_id: experiment.id, day_number: day, phase: day <= 3 ? 'baseline' : 'intervention', intervention_completed: true, metric_values: { morning_energy: 7, sleep_quality: 6 }, note: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(`${base}/`) || url === base) return route.continue();
    const method = route.request().method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const at = url.replace(API, '');
    let body;
    if (url.includes('/auth/v1/token')) body = { access_token: jwt, refresh_token: 'fake', expires_in: 3600, token_type: 'bearer', user };
    else if (url.includes('/auth/v1/user')) body = user;
    else if (at === '/api/profile') body = profile;
    else if (at === '/api/experiments?status=active') body = list;
    else if (at === '/api/experiments?status=completed') body = [labReport.experiment];
    else if (at === '/api/experiments/capacity') body = { active: list.length, limit: 3, can_start: list.length < 3 };
    else if (at === '/api/experiments/progress-summary') body = { metrics: [{ key: 'energy', label: 'Morning energy', type: 'scale', normal_change: 1.25, runs: [{ experiment_id: 'a', question: 'Does a walk help?', baseline_mean: 5, result_mean: 6, percent_change: 20, completed_at: null }] }], kept: [{ experiment_id: 'k', habit: 'Walk for 20 minutes', question: 'Does a walk help?' }], example: null };
    else if (at === '/api/experiments/calibration') body = { points: [], trend: null, average_off_by_points: null, example: null };
    else if (at === '/api/experiments/propose') body = { ...proposeResponse, personal_guess_available: true };
    else if (at === '/api/checkins/today') body = today(list);
    else if (at.endsWith('/progress')) { const item = list.find(entry => at.includes(entry.id)) ?? list[0]; body = timelineFixture(item, { recorded, nextDayAt: '2026-11-07T18:00:00Z' }); }
    else if (at.endsWith('/checkins')) body = method === 'GET' ? checkins : checkins[0] ?? { id: 'saved' };
    else if (at.endsWith('/report')) body = writtenLabReport;
    else return route.abort();
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('fake-preview-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('tab', { name: 'Today' }).waitFor();
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: '[data-example-badge]{position:fixed;right:12px;top:6px;z-index:9999;background:Canvas;color:CanvasText;font:12px sans-serif;padding:2px 4px;border:1px solid currentColor;border-radius:4px;pointer-events:none}' });
  await page.evaluate(() => { const tag = document.createElement('div'); tag.dataset.exampleBadge = ''; tag.textContent = 'Example · mocked API'; document.body.appendChild(tag); });
  return { page, context, errors };
}
const shoot = async (page, group, name, mode) => {
  await page.waitForTimeout(400);
  fs.mkdirSync(path.join(output, group), { recursive: true });
  await page.screenshot({ path: path.join(output, group, `${name}-${mode}.png`) });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${name}: horizontal overflow`);
};
const radio = (page, name) => page.getByRole('radio', { name, exact: true }).click();
const button = (page, name) => page.getByRole('button', { name, exact: true }).click();

const GROUPS = {
  async know(browser, mode) {
    const run = await open(browser, { mode, list: [] });
    await run.page.getByRole('tab', { name: 'Ask' }).click();
    await run.page.getByLabel('Your question or goal', { exact: true }).fill(proposeResponse.proposal.question);
    await button(run.page, 'Design experiment');
    await button(run.page, 'Next');
    await run.page.getByLabel(/^Your guess for/).fill('10');
    await button(run.page, 'Show prediction');
    await button(run.page, 'Next');
    await shoot(run.page, 'know', '1-plan-line', mode);
    await run.context.close();
    const report = await open(browser, { mode, list: [] });
    await report.page.getByRole('tab', { name: 'History' }).click();
    await report.page.getByRole('button', { name: /^Open Lab Report/ }).click();
    await report.page.getByRole('button', { name: 'How we know', exact: true }).waitFor();
    await button(report.page, 'How we know');
    await shoot(report.page, 'know', '2-how-we-know', mode);
    if (report.errors.length) throw new Error(report.errors.join('\n'));
    await report.context.close();
  },
  async screens(browser, mode) {
    const run = await open(browser, { mode, list: [on(4, 'intervention')], recorded: [1, 2, 3] });
    await run.page.getByRole('tab', { name: 'Ask' }).click();
    await run.page.getByRole('button', { name: 'How it works', exact: true }).waitFor();
    await shoot(run.page, 'screens', '1-ask', mode);
    await run.page.getByRole('tab', { name: 'Progress' }).click();
    await run.page.getByText('Day by day', { exact: true }).waitFor();
    await shoot(run.page, 'screens', '2-progress', mode);
    await run.page.getByRole('tab', { name: 'History' }).click();
    await run.page.getByRole('button', { name: /^Open Lab Report/ }).waitFor();
    await shoot(run.page, 'screens', '3-history', mode);
    await run.page.getByRole('button', { name: /^Open Lab Report/ }).click();
    await run.page.getByRole('button', { name: 'Compare with the prediction', exact: true }).waitFor();
    await shoot(run.page, 'screens', '4-report', mode);
    await button(run.page, 'Compare with the prediction');
    await shoot(run.page, 'screens', '5-report-compared', mode);
    await button(run.page, 'Details');
    await shoot(run.page, 'screens', '6-report-details', mode);
    if (run.errors.length) throw new Error(run.errors.join('\n'));
    await run.context.close();
  },
  async plan(browser, mode) {
    const run = await open(browser, { mode, list: [] });
    await run.page.getByRole('tab', { name: 'Ask' }).click();
    await run.page.getByLabel('Your question or goal', { exact: true }).fill(proposeResponse.proposal.question);
    await button(run.page, 'Design experiment');
    await run.page.getByRole('button', { name: 'Details', exact: true }).waitFor();
    await shoot(run.page, 'plan', '1-change', mode);
    await button(run.page, 'Details');
    await shoot(run.page, 'plan', '1b-details-sheet', mode);
    await button(run.page, 'Done');
    await button(run.page, 'Next');
    await run.page.getByLabel(/^Your guess for/).waitFor();
    await run.page.getByLabel(/^Your guess for/).fill('10');
    await shoot(run.page, 'plan', '2-guess', mode);
    await button(run.page, 'Show prediction');
    await shoot(run.page, 'plan', '3-reveal', mode);
    await button(run.page, 'Next');
    await shoot(run.page, 'plan', '4-days', mode);
    const scrolls = await run.page.evaluate(() => [...document.querySelectorAll('*')].some(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1));
    if (scrolls) throw new Error('The last plan step needs scrolling');
    if (run.errors.length) throw new Error(run.errors.join('\n'));
    await run.context.close();
  },
  async today(browser, mode) {
    let run = await open(browser, { mode, list: [on(4, 'intervention')] });
    await shoot(run.page, 'today', '1-due', mode);
    await button(run.page, "Today's change");
    await shoot(run.page, 'today', '2-change-sheet', mode);
    await button(run.page, 'Done');
    await button(run.page, 'See your experiment');
    await run.page.getByRole('button', { name: 'Prediction', exact: true }).waitFor();
    await shoot(run.page, 'today', '3-experiment', mode);
    await button(run.page, 'Prediction');
    await shoot(run.page, 'today', '4-prediction-sheet', mode);
    if (run.errors.length) throw new Error(run.errors.join('\n'));
    await run.context.close();
    run = await open(browser, { mode, list: [on(1, 'baseline')], recorded: [1] });
    await shoot(run.page, 'today', '5-recorded', mode);
    await run.context.close();
    run = await open(browser, { mode, list: [on(4, 'intervention'), second] });
    await shoot(run.page, 'today', '6-two-running', mode);
    await run.context.close();
  },
  async checkin(browser, mode) {
    let run = await open(browser, { mode, list: [on(4, 'intervention')] });
    await button(run.page, 'Check in now, day 4');
    await run.page.getByRole('radio', { name: 'Not today', exact: true }).waitFor();
    await shoot(run.page, 'checkin', '1-change', mode);
    await radio(run.page, 'Yes, I made the change');
    await shoot(run.page, 'checkin', '2-question', mode);
    await radio(run.page, 'Morning energy: 7');
    await radio(run.page, 'Sleep quality: 6');
    await shoot(run.page, 'checkin', '3-review', mode);
    await button(run.page, 'Add a note');
    await shoot(run.page, 'checkin', '4-review-note', mode);
    await button(run.page, 'Save check-in');
    await run.page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
    await shoot(run.page, 'checkin', '5-celebration', mode);
    if (run.errors.length) throw new Error(run.errors.join('\n'));
    await run.context.close();
    run = await open(browser, { mode, list: [on(4, 'intervention'), second] });
    await run.page.getByRole('button', { name: /^Check in now, day/ }).first().click();
    await radio(run.page, 'Yes, I made the change');
    await run.page.getByRole('radio', { name: 'Morning energy: 7', exact: true }).waitFor();
    await shoot(run.page, 'checkin', '6-combined', mode);
    if (run.errors.length) throw new Error(run.errors.join('\n'));
    await run.context.close();
    run = await open(browser, { mode, list: [on(4, 'intervention')], recorded: [4] });
    await button(run.page, "Edit today's answers");
    await run.page.getByRole('radio', { name: 'Yes, I made the change', exact: true }).waitFor();
    await shoot(run.page, 'checkin', '7-edit-prefilled', mode);
    await run.context.close();
  },
};

(async () => {
  const groups = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const group of groups) for (const mode of ['light', 'dark']) await GROUPS[group](browser, mode);
    console.log(`Captured ${groups.join(', ')} in ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
