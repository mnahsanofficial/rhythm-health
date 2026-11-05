/* Expo-web evidence for the short-labels PR, with the long sentences from the 5 Nov iPhone test.
 * Every external request is intercepted: no account, AI call or database.
 *
 * In apps/mobile:
 *   EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://supabase.test.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=fake-public-anon-key \
 *     EXPO_PUBLIC_API_URL=http://api.test.invalid:8001 npx expo export --platform web --output-dir "$BUILD"
 *   node ../../frontend/tests/capture/static-server.mjs "$BUILD" 8096 &
 *   node scripts/capture-short-labels.cjs
 */
/* global __dirname */
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'docs/screenshots/mobile-short-labels');
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

const scale = { type: 'scale', min: 1, max: 10, min_label: 'Drained', max_label: 'Full of energy' };
const metrics = [
  { key: 'morning_energy', label: 'How energetic do you feel about 1 hour after waking?', short_label: 'Morning energy', unit: '/10', primary: true, ...scale },
  { key: 'focus', label: 'How focused do you feel in the first 2 hours of work?', short_label: 'Focus', unit: '/10', primary: false, ...scale, min_label: 'Scattered', max_label: 'Clear' },
  { key: 'time_to_fall_asleep', label: 'About how many minutes did it take you to fall asleep?', short_label: 'Minutes to fall asleep', unit: 'min', type: 'number', min: null, max: null, min_label: null, max_label: null, primary: false },
];
const intervention = { action: 'Walk 5 km at a comfortable steady pace (not intense). Keep everything else the same, including your usual workout, coffee and sleep schedule.', timing: 'After dinner', frequency: 'Daily', change_short: 'Walk 5 km after dinner', short_name: 'Evening walk' };
const question = 'Does having one cup of coffee about 8 hours before bedtime change how long it takes me to fall asleep?';
const on = (day, phase, extra = {}) => ({ ...experiment, status: 'active', metrics, intervention, question, ...extra, progress: { ...experiment.progress, state: 'in_progress', day_number: day, total_days: 10, days_remaining: 10 - day, phase, phase_day: phase === 'baseline' ? day : day - 3, phase_days: phase === 'baseline' ? 3 : 7, started_at: '2026-11-01T09:00:00Z' } });
const exampleQuestion = 'Does a 20-minute walk after dinner improve my morning energy?';
const example = { question: exampleQuestion, metrics: [['Morning energy', 5.7, 6.3, 11], ['Sleep quality', 6.3, 6.7, 6]].map(([label, before, after, change]) => ({ key: label, label, short_label: label, unit: '/10', type: 'scale', normal_change: null, runs: [{ experiment_id: 'example', short_name: 'Evening walk', question: exampleQuestion, completed_at: null, baseline_mean: before, result_mean: after, percent_change: change }] })) };
const prediction = { ...proposeResponse.prediction, target_metric: 'morning_energy', expected_change_min: 2, expected_change_max: 10, confidence: 'low' };
const proposal = { ...proposeResponse.proposal, question: 'Daily 5km walk is helpful?', intervention, metrics, success_criteria: { primary_metric: 'morning_energy', minimum_change_percent: 10 } };

async function open(browser, { mode, list, recorded = [], saved = {} }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Dhaka', colorScheme: mode });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /same key|unique.*key/i.test(message.text())) errors.push(message.text()); });
  const checkins = recorded.map(day => ({ id: `c${day}`, experiment_id: experiment.id, day_number: day, phase: day <= 3 ? 'baseline' : 'intervention', intervention_completed: true, metric_values: saved, note: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }));
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
    else if (at === '/api/experiments/progress-summary') body = { metrics: [], kept: [], example };
    else if (at === '/api/experiments/calibration') body = { points: [], trend: null, average_off_by_points: null, example: null };
    else if (at === '/api/experiments/propose') body = { ...proposeResponse, proposal, prediction, personal_guess_available: true };
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
  return { page, context, errors };
}
const shoot = async (page, name, mode) => {
  await page.waitForTimeout(700);
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, `${name}-${mode}.png`) });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${name}: horizontal overflow`);
};
const button = (page, name) => page.getByRole('button', { name, exact: true }).click();
const radio = (page, name) => page.getByRole('radio', { name, exact: true }).click();
const heading = (page, name) => page.getByRole('heading', { name, exact: true }).waitFor();
/** A heading that wraps or clips isn't one line: this is the rule the screenshots exist to show. */
const oneLine = (page, name) => page.evaluate(() => [...document.querySelectorAll('[role="heading"]')].filter(node => node.offsetParent !== null).map(node => [node.textContent, node.scrollWidth > node.clientWidth + 1, node.getClientRects().length && node.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight) * 1.5])).then(found => {
  const bad = found.filter(([, clipped, tall]) => clipped || tall);
  if (bad.length) throw new Error(`${name}: not one line: ${bad.map(([text]) => text).join(', ')}`);
});
const snap = async (page, name, mode) => { await shoot(page, name, mode); await oneLine(page, name); };

async function plan(browser, mode) {
  const { page, context, errors } = await open(browser, { mode, list: [] });
  await page.getByRole('tab', { name: 'Ask' }).click();
  await page.getByLabel('Your question or goal', { exact: true }).fill(proposal.question);
  await button(page, 'Design experiment');
  await heading(page, 'Walk 5 km after dinner');
  await snap(page, '2-change', mode);
  await button(page, 'Next');
  await heading(page, 'Your guess');
  await snap(page, '3-guess-empty', mode);
  await button(page, 'Raise guess by 5'); await button(page, 'Raise guess by 5');
  await snap(page, '3-guess-10', mode);
  await page.getByLabel(/^Your guess for/).fill('50');
  await snap(page, '3-guess-50', mode);
  await page.getByLabel(/^Your guess for/).fill('10');
  await button(page, 'Show prediction');
  await heading(page, 'Morning energy is likely to go up');
  await snap(page, '4-reveal', mode);
  await button(page, 'Next');
  await heading(page, 'Your 10 days');
  await page.waitForTimeout(2500);
  await snap(page, '5-days', mode);
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
}
async function progress(browser, mode) {
  const { page, context, errors } = await open(browser, { mode, list: [on(1, 'baseline')], recorded: [1], saved: { morning_energy: 10, focus: 10, time_to_fall_asleep: 90 } });
  await page.getByRole('tab', { name: 'Progress' }).click();
  await page.getByRole('button', { name: 'The question', exact: true }).waitFor();
  await snap(page, '1-progress', mode);
  await button(page, 'The question');
  await shoot(page, '1-progress-question', mode);
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
}
async function checkin(browser, mode) {
  let run = await open(browser, { mode, list: [on(4, 'intervention')], recorded: [1, 2, 3] });
  await button(run.page, 'Check in now, day 4');
  await heading(run.page, 'Did you make the change?');
  await snap(run.page, '7-new-change', mode);
  await radio(run.page, 'Yes, I made the change');
  await heading(run.page, 'Morning energy');
  await snap(run.page, '7-new-scale', mode);
  await radio(run.page, 'Morning energy: 7');
  await heading(run.page, 'Focus');
  await radio(run.page, 'Focus: 7');
  await heading(run.page, 'Minutes to fall asleep');
  await snap(run.page, '7-new-typed', mode);
  if (run.errors.length) throw new Error(run.errors.join('\n'));
  await run.context.close();
  run = await open(browser, { mode, list: [on(4, 'intervention')], recorded: [1, 2, 3, 4], saved: { morning_energy: 10, focus: 10, time_to_fall_asleep: 90 } });
  await button(run.page, "Edit today's answers");
  await heading(run.page, 'Did you make the change?');
  await snap(run.page, '7-edit-change', mode);
  await button(run.page, 'Next');
  await heading(run.page, 'Morning energy');
  await snap(run.page, '7-edit-scale', mode);
  await button(run.page, 'Next');
  await heading(run.page, 'Focus');
  await button(run.page, 'Next');
  await heading(run.page, 'Minutes to fall asleep');
  await snap(run.page, '7-edit-typed', mode);
  await button(run.page, 'Next');
  await heading(run.page, 'Review');
  await snap(run.page, '6-review', mode);
  if (run.errors.length) throw new Error(run.errors.join('\n'));
  await run.context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const mode of ['light', 'dark']) { await progress(browser, mode); await plan(browser, mode); await checkin(browser, mode); console.log(`${mode}: done`); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
