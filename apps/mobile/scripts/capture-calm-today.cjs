/* Isolated Expo-web evidence. Serve an export made with the fake settings below on port 8096.
 * Every external request is intercepted; this script never contacts auth, API, AI or a database.
 * EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://supabase.test.invalid
 * EXPO_PUBLIC_SUPABASE_ANON_KEY=fake-public-anon-key EXPO_PUBLIC_API_URL=http://api.test.invalid:8001
 */
/* global __dirname */
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'docs/screenshots/mobile-calm-today');
function load(relative) {
  const file = path.join(root, relative);
  const mod = new Module(file);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
const { experiment, profile, labReport } = load('frontend/tests/support/fixtures.ts');
const { timelineFixture } = load('frontend/tests/support/timeline-fixture.ts');
const base = process.env.CALM_PREVIEW_URL ?? 'http://127.0.0.1:8096';
const scenarios = ['due', 'recorded', 'day10', 'three', 'empty'];
const fakeJwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: profile.id, exp: 2100000000, iat: 1793850000, role: 'authenticated' })).toString('base64url'), 'fake',
].join('.');
const user = { id: profile.id, email: 'example@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' };
function fixture(scenario, mode) {
  const last = scenario === 'day10';
  const active = { ...experiment, status: 'active', progress: { ...experiment.progress, state: 'in_progress', day_number: last ? 10 : 4, phase: 'intervention', phase_day: last ? 7 : 1, phase_days: 7, days_remaining: last ? 0 : 6, started_at: '2026-11-02T10:00:00Z' } };
  const list = scenario === 'empty' ? [] : scenario === 'three' ? [active, { ...active, id: 'second-id', question: 'Does morning light help my focus?' }, { ...active, id: 'third-id', question: 'Does an earlier bedtime help my energy?' }] : [active];
  return { list, timeline: timelineFixture(active, { recorded: last ? [1, 2, 3, 4, 6, 7, 8, 9, 10] : scenario === 'recorded' ? [1, 3, 4] : [1, 3], missed: last ? [5] : [2], nextDayAt: mode === 'dark' ? '2026-11-06T10:00:00Z' : '2026-11-05T10:00:00Z' }) };
}
async function preview(browser, scenario, mode, height = 844, reducedMotion = 'no-preference', width = 390) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Dhaka', colorScheme: mode, reducedMotion });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(mode === 'dark' ? '2026-11-05T14:00:00Z' : '2026-11-05T03:00:00Z'));
  const { list, timeline } = fixture(scenario, mode);
  const errors = [], blocked = [], calls = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /same key|unique.*key/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(base + '/')) return route.continue();
    calls.push(`${route.request().method()} ${new URL(url).pathname}`);
    let body;
    if (url.startsWith('https://supabase.test.invalid/auth/v1/token')) body = { access_token: fakeJwt, refresh_token: 'fake-refresh', expires_in: 3600, token_type: 'bearer', user };
    else if (url === 'https://supabase.test.invalid/auth/v1/user') body = user;
    else if (url === 'http://api.test.invalid:8001/api/profile') body = profile;
    else if (url === 'http://api.test.invalid:8001/api/experiments?status=active') body = list;
    else if (url === 'http://api.test.invalid:8001/api/experiments/capacity') body = { active: list.length, limit: 3, can_start: list.length < 3 };
    else if (url === 'http://api.test.invalid:8001/api/checkins/today') body = { revision: 'example', all_recorded: false, experiments: [], questions: [], note: null };
    else if (url.startsWith('http://api.test.invalid:8001/api/experiments/') && url.endsWith('/progress')) body = timeline;
    else if (url.startsWith('http://api.test.invalid:8001/api/experiments/') && url.endsWith('/checkins') && route.request().method() === 'GET') body = timeline.days.filter(day => day.state === 'recorded').map(day => ({ id: `example-${day.day_number}`, experiment_id: new URL(url).pathname.split('/')[3], day_number: day.day_number, phase: day.phase === 'test' ? 'intervention' : 'baseline', metric_values: { morning_energy: 5, sleep_quality: 6 }, intervention_completed: day.phase === 'test' ? true : null, note: null, created_at: '2026-11-05T03:00:00Z', updated_at: '2026-11-05T03:00:00Z' }));
    else if (url.startsWith('http://api.test.invalid:8001/api/experiments/') && url.endsWith('/complete')) body = labReport;
    else if (url.startsWith('http://api.test.invalid:8001/api/experiments/') && url.endsWith('/report') && route.request().method() === 'GET') body = labReport;
    else { blocked.push(url); return route.abort(); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('fake-preview-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('Up next', { exact: true }).waitFor();
  await page.evaluate(() => {
    const label = document.createElement('div');
    label.textContent = 'Example · mocked API';
    label.style.cssText = 'position:fixed;right:12px;top:6px;z-index:9999;background:Canvas;color:CanvasText;font:12px sans-serif;padding:2px 4px;border:1px solid currentColor;border-radius:4px;pointer-events:none';
    document.body.appendChild(label);
  });
  if (scenario === 'due' && mode === 'light' && height === 844 && reducedMotion === 'no-preference') {
    await page.screenshot({ path: path.join(output, 'due-enter.png') });
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(output, 'due-during.png') });
  }
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('*')].filter(element => {
    const style = getComputedStyle(element);
    return /auto|scroll/.test(style.overflowY) && element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1;
  }).map(element => ({ height: element.clientHeight, content: element.scrollHeight })));
  if (scenario !== 'three' && overflow.length) throw new Error(`${scenario}/${mode}/${height} needs scrolling: ${JSON.stringify(overflow)}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow');
  return { page, context, errors, blocked, calls, overflow };
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const evidence = [];
  try {
    for (const mode of ['light', 'dark']) for (const scenario of scenarios) {
      const run = await preview(browser, scenario, mode);
      await run.page.screenshot({ path: path.join(output, `${scenario}-${mode}.png`) });
      if (scenario === 'due') {
        const action = run.page.getByRole('button', { name: 'Check in now, day 4', exact: true });
        const before = await action.boundingBox();
        await run.page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
        await run.page.mouse.down();
        await run.page.waitForTimeout(200);
        const pressed = await action.boundingBox();
        if (pressed.width >= before.width - 1 || pressed.width < before.width * 0.95) throw new Error('Normal press feedback is missing or excessive');
        if (mode === 'light') await run.page.screenshot({ path: path.join(output, 'due-pressed.png') });
        await run.page.mouse.up();
        await run.page.getByText("Today's check-in.", { exact: true }).waitFor();
        await run.page.getByRole('button', { name: 'Close', exact: true }).click();
        await run.page.getByText('Up next', { exact: true }).waitFor();
        await run.page.getByRole('button', { name: 'See your experiment', exact: true }).click();
        await run.page.getByText('Your timeline', { exact: true }).waitFor();
      }
      if (scenario === 'recorded') {
        await run.page.getByRole('button', { name: "Edit today's answers", exact: true }).click();
        await run.page.getByRole('button', { name: 'Update check-in', exact: true }).waitFor();
      }
      if (scenario === 'day10') {
        await run.page.getByRole('button', { name: 'See your results', exact: true }).click();
        await run.page.getByRole('button', { name: 'See full Lab Report', exact: true }).click();
        await run.page.getByRole('button', { name: 'Compare with the prediction', exact: true }).waitFor();
      }
      if (scenario === 'three') {
        await run.page.getByRole('button', { name: 'Open Does morning light help my focus?', exact: true }).click();
        await run.page.getByText('Your timeline', { exact: true }).waitFor();
        await run.page.getByRole('heading', { name: 'Does morning light help my focus?', exact: true }).waitFor();
      }
      if (scenario === 'empty') {
        await run.page.getByRole('button', { name: 'Ask your first question', exact: true }).click();
        await run.page.getByLabel('Your question or goal', { exact: true }).waitFor();
      }
      if (run.errors.length || run.blocked.length) throw new Error(JSON.stringify({ errors: run.errors, blocked: run.blocked }));
      evidence.push({ scenario, mode, viewport: '390x844', overflow: run.overflow, errors: run.errors, externalRequestsBlocked: run.blocked.length });
      await run.context.close();
    }
    for (const mode of ['light', 'dark']) {
      const desktop = await preview(browser, 'due', mode, 900, 'reduce', 1440);
      await desktop.page.screenshot({ path: path.join(output, `due-desktop-${mode}.png`) });
      evidence.push({ scenario: 'due', mode, viewport: '1440x900', overflow: desktop.overflow, errors: desktop.errors });
      if (desktop.errors.length || desktop.blocked.length) throw new Error('Desktop preview failed');
      await desktop.context.close();
    }
    const safe = await preview(browser, 'due', 'light', 763, 'reduce');
    await safe.page.screenshot({ path: path.join(output, 'due-safe-area-reduced-motion.png') });
    evidence.push({ scenario: 'due', viewport: '390x763 (844 minus 81pt safe areas)', reducedMotion: true, overflow: safe.overflow });
    const button = safe.page.getByRole('button', { name: 'Check in now, day 4', exact: true });
    const before = await button.boundingBox();
    await safe.page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await safe.page.mouse.down();
    await safe.page.waitForTimeout(200);
    const pressed = await button.boundingBox();
    if (Math.abs(before.width - pressed.width) > 0.1) throw new Error('Reduced Motion still scales the action');
    await safe.page.mouse.move(0, 0);
    await safe.page.mouse.up();
    await safe.page.evaluate(() => {
      const originals = [...document.querySelectorAll('[dir="auto"]')].map(element => {
        const style = getComputedStyle(element);
        return { element, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), multiplier: element.closest('[role="tab"]') ? 1.3 : 2 };
      });
      for (const { element, font, line, multiplier } of originals) {
        element.style.fontSize = `${font * multiplier}px`;
        element.style.lineHeight = `${line * multiplier}px`;
      }
    });
    await safe.page.getByRole('button', { name: 'Check in now, day 4', exact: true }).scrollIntoViewIfNeeded();
    await safe.page.screenshot({ path: path.join(output, 'due-large-text-reduced-motion.png') });
    if (await safe.page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Large text has horizontal overflow');
    await safe.context.close();
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`Verified ${evidence.length} layouts; screenshots in ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
