// Product review walkthrough: Expo web export, every request mocked, everything else blocked.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WT = process.env.WT ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = process.env.WEB ?? join(tmpdir(), 'rhythm-review/web'); // npx expo export --platform web, with fake EXPO_PUBLIC_* values
const OUT = process.env.OUT ?? join(tmpdir(), 'rhythm-review/shots');
const AUDIT = process.env.AUDIT ?? join(tmpdir(), 'rhythm-review/audit');
const only = process.env.ONLY?.split(',');
const themes = (process.env.THEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];
const { chromium } = createRequire(join(WT, 'frontend/package.json'))('@playwright/test');
const F = await import(join(WT, 'frontend/tests/support/fixtures.ts'));
const { timelineFixture } = await import(join(WT, 'frontend/tests/support/timeline-fixture.ts'));

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url!.split('?')[0]);
  const file = join(WEB, path);
  const target = path !== '/' && existsSync(file) ? file : join(WEB, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
  res.end(readFileSync(target));
});
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const ORIGIN = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const ID = F.experiment.id;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const tomorrow = new Date(Date.now() + 18 * 3600_000).toISOString();
const started = new Date(Date.now() - 3 * 86_400_000).toISOString();
const running = (day: number, patch: object = {}) => {
  const baseline = day <= 3;
  return { ...F.experiment, status: 'active', started_at: started, ...patch,
    progress: { ...F.experiment.progress, state: 'in_progress', started_at: started, ends_at: tomorrow, day_number: day, phase: baseline ? 'baseline' : 'intervention', phase_day: baseline ? day : day - 3, phase_days: baseline ? 3 : 7, days_remaining: 10 - day } };
};
const NORMAL = { days_recorded: 3, days_planned: 3, metrics: [{ key: 'morning_energy', label: 'Morning energy', type: 'scale', description: 'Morning energy: about 5.3 out of 10.' }, { key: 'sleep_quality', label: 'Sleep quality', type: 'scale', description: 'Sleep quality: about 6.3 out of 10.' }] };
const checkin = (day: number) => ({ id: `c${day}`, experiment_id: ID, day_number: day, phase: day <= 3 ? 'baseline' : 'intervention', metric_values: { morning_energy: 5 + (day % 3), sleep_quality: 6 + (day % 2) }, intervention_completed: day > 3 ? day !== 6 : null, note: day === 2 ? 'Late night.' : null, created_at: started, updated_at: started });
const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const GUESS = { guessed_change_percent: 12, observed_change_percent: 20.5, error_points: 8.5 };
const report = (written = false) => { const base = written ? F.writtenLabReport : F.labReport; return { ...base, experiment: { ...base.experiment, personal_guess_percent: 12 }, analysis: { ...base.analysis, personal_guess: GUESS } }; };
const seededReport = { ...F.labReport, experiment: { ...F.labReport.experiment, is_seeded: true, id: 'sample-1' } };
const SECOND = { ...running(4), id: '44444444-4444-4444-4444-444444444444', question: 'Does no coffee after 2pm help me fall asleep faster?', intervention: { action: 'No coffee after 2pm', timing: 'From 2pm onward', frequency: 'daily' }, metrics: [{ ...F.experiment.metrics[1], primary: true }] };
const TODAY_COMBINED = { revision: 'r1', note: null, all_recorded: false, experiments: [
  { id: ID, question: F.experiment.question, day_number: 4, total_days: 10, recorded: false, change_required: true, change_made: null, action: 'Walk for 20 minutes', timing: 'Within one hour after dinner' },
  { id: SECOND.id, question: SECOND.question, day_number: 4, total_days: 10, recorded: false, change_required: true, change_made: null, action: 'No coffee after 2pm', timing: 'From 2pm onward' } ],
  questions: [{ id: 'sleep_quality:scale', experiment_ids: [ID, SECOND.id], metric: F.experiment.metrics[1], value: null }, { id: 'morning_energy:scale', experiment_ids: [ID], metric: F.experiment.metrics[0], value: null }] };
const SUMMARY = { kept: [], example: null, metrics: [{ key: 'morning_energy', label: 'Morning energy', type: 'scale', normal_change: 0.6, runs: [
  { experiment_id: 'a', question: 'Does morning light help my energy?', completed_at: '2026-10-05T10:00:00Z', baseline_mean: 5, result_mean: 5.6, percent_change: 12 },
  { experiment_id: ID, question: F.experiment.question, completed_at: '2026-10-28T09:00:00Z', baseline_mean: 5.6, result_mean: 6.4, percent_change: 14 }] }] };
const EXAMPLE_SUMMARY = { kept: [], metrics: [], example: { question: 'Does a 20-minute walk after dinner improve my morning energy?', metrics: SUMMARY.metrics } };
const CALIBRATION = { trend: 'closer', average_off_by_points: 11, example: null, points: [
  { experiment_id: 'x', question: 'Does no phone in bed help me sleep?', guessed_change_percent: 30, observed_change_percent: 8, off_by_points: 22, completed_at: '2026-09-20T10:00:00Z' },
  { experiment_id: 'a', question: 'Does morning light help my energy?', guessed_change_percent: 20, observed_change_percent: 12, off_by_points: 8, completed_at: '2026-10-05T10:00:00Z' },
  { experiment_id: ID, question: F.experiment.question, guessed_change_percent: 12, observed_change_percent: 20, off_by_points: 8, completed_at: '2026-10-28T09:00:00Z' }] };
const CAL_EMPTY = { trend: null, average_off_by_points: null, points: [], example: { question: F.experiment.question, guessed_change_percent: 15, observed_change_percent: 20, off_by_points: 5 } };
const fakeJwt = (() => { const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${enc({ alg: 'none' })}.${enc({ sub: 'fake-user', exp: Math.floor(Date.now() / 1000) + 86400 })}.x`; })();
const SESSION = { access_token: fakeJwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: 'fake-user', aud: 'authenticated', role: 'authenticated', email: 'review@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } };

type Reply = { status?: number; body?: unknown; delay?: number } | (() => { status?: number; body?: unknown; delay?: number });
type Routes = Record<string, Reply>;
const audits: Record<string, unknown>[] = [];
const problems: string[] = [];
const texts: Record<string, string> = {};

const auditPage = () => {
  const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const parse = (s: string) => { const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
  const bg = (el: Element | null) => { while (el) { const p = parse(getComputedStyle(el).backgroundColor); if (p.a > 0.9) return p.rgb; el = el.parentElement; } return [255, 255, 255]; };
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.right > 0 && r.left < innerWidth; };
  const small: string[] = [], lowContrast: string[] = [], tiny: string[] = [], unnamed: string[] = [];
  const seen = new Set<string>();
  for (const el of document.querySelectorAll('[role=button],[role=link],[role=tab],[role=radio],[role=checkbox],[role=switch],input,textarea,button,a')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').trim().slice(0, 40);
    if (!name) unnamed.push(`${el.tagName}[${el.getAttribute('role') ?? ''}]`);
    if (r.width < 43.5 || r.height < 43.5) tiny.push(`${name || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  let words = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent!.trim()).map(n => n.textContent!.trim()).join(' ');
    if (!own) continue;
    words += own.split(/\s+/).length;
    const s = getComputedStyle(el); const size = parseFloat(s.fontSize);
    const label = own.slice(0, 44);
    if (size < 13 && !seen.has(`s${label}`)) { seen.add(`s${label}`); small.push(`${size}px ${label}`); }
    const fg = parse(s.color).rgb, back = bg(el);
    const [a, b] = [lum(fg), lum(back)]; const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5 && !seen.has(`c${label}`)) { seen.add(`c${label}`); lowContrast.push(`${ratio.toFixed(2)} ${size}px ${label}`); }
  }
  let scroll = document.documentElement; let max = 0;
  for (const el of document.querySelectorAll('div')) { const s = getComputedStyle(el); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > max && el.clientHeight > 100) { max = el.scrollHeight; scroll = el as HTMLElement; } }
  const headings = [...document.querySelectorAll('[role=heading],h1,h2,h3')].filter(visible).map(el => (el as HTMLElement).innerText.slice(0, 50));
  return { words, tiny, small, lowContrast, unnamed, headings, scrollHeight: max, viewHeight: scroll.clientHeight, fold: scroll.clientHeight };
};

async function open(theme: 'light' | 'dark', routes: Routes, opts: { profile?: unknown; reduced?: boolean } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: theme, timezoneId: 'Asia/Dhaka', locale: 'en-GB', hasTouch: true, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const calls: string[] = [];
  page.on('pageerror', (e: Error) => problems.push(`pageerror: ${e.message}`));
  await context.route('**/*', async (route: any) => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin === ORIGIN) return route.continue();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.hostname === 'supabase.test.invalid') {
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(SESSION) });
    }
    if (url.hostname === 'api.test.invalid') {
      const key = `${req.method()} ${url.pathname}${url.search}`; calls.push(key);
      const entry = routes[key];
      const reply = typeof entry === 'function' ? entry() : entry;
      if (!reply) { problems.push(`unmocked: ${key}`); return route.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: JSON.stringify({ detail: `Not mocked: ${key}` }) }); }
      if (reply.delay) await new Promise(r => setTimeout(r, reply.delay));
      return route.fulfill({ status: reply.status ?? 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(reply.body ?? null) });
    }
    problems.push(`blocked: ${req.url()}`);
    return route.abort();
  });
  await page.goto(ORIGIN);
  return { browser, context, page, calls };
}

const safeName = (s: string) => s.replace(/[^a-z0-9-]+/gi, '-');
function shooter(theme: string, persona: string, page: any) {
  mkdirSync(join(OUT, theme), { recursive: true });
  return async (name: string, { full = true, settle = 900, large = false }: { full?: boolean; settle?: number; large?: boolean } = {}) => {
    await page.waitForTimeout(settle);
    if (large) await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim()); if (!own) continue; const s = getComputedStyle(el); (el as HTMLElement).style.fontSize = `${parseFloat(s.fontSize) * 1.35}px`; if (s.lineHeight !== 'normal') (el as HTMLElement).style.lineHeight = `${parseFloat(s.lineHeight) * 1.35}px`; } });
    const file = `${safeName(persona)}-${safeName(name)}`;
    await page.screenshot({ path: join(OUT, theme, `${file}.png`) });
    const a = await page.evaluate(auditPage);
    audits.push({ theme, screen: file, ...a });
    if (theme === 'light') texts[file] = await page.evaluate(() => document.body.innerText);
    if (full && a.scrollHeight > 844 && a.scrollHeight < 6000) {
      const extra = a.scrollHeight - a.viewHeight;
      await page.setViewportSize({ width: 390, height: 844 + extra });
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(OUT, theme, `${file}__full.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
    }
  };
}
const btn = (page: any, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
async function signIn(page: any) {
  await btn(page, 'Sign in').click();
  await page.getByLabel('Email').fill('review@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('fake-review-only');
  await page.getByTestId('submit-action').click();
}
const tab = (page: any, name: string) => page.getByRole('tab', { name }).click();
async function safely(label: string, fn: () => Promise<void>) { try { await fn(); } catch (e) { problems.push(`${label}: ${(e as Error).message.split('\n').slice(0, 2).join(' ')}`); } }

const profileOk = { 'GET /api/profile': { body: F.profile } };
const active = (experiments: unknown[]) => ({ 'GET /api/experiments?status=active': { body: experiments } });
const hist = { 'GET /api/experiments?status=completed': { body: [] }, 'GET /api/experiments/calibration': { body: CAL_EMPTY }, 'GET /api/experiments/progress-summary': { body: EXAMPLE_SUMMARY } };

const SCENARIOS: Record<string, (theme: 'light' | 'dark') => Promise<void>> = {
  async ana(theme) {
    let profile: unknown = null; let list: unknown[] = []; let exp: any = running(1);
    const routes: Routes = { ...hist,
      'GET /api/profile': () => profile ? { body: profile } : { status: 404, body: { detail: 'Profile not found' } },
      'PUT /api/profile': () => { profile = F.profile; return { body: F.profile }; },
      'GET /api/experiments?status=active': () => ({ body: list }),
      'POST /api/experiments/propose': { delay: 1200, body: { ...F.proposeResponse, personal_guess_available: true } },
      'POST /api/experiments': { body: { ...F.experiment, id: ID } },
      [`POST /api/experiments/${ID}/start`]: () => { list = [exp]; return { body: exp }; },
      [`GET /api/experiments/${ID}/progress`]: () => ({ body: timelineFixture(exp, { nextDayAt: tomorrow }) }),
      [`GET /api/experiments/${ID}/checkins`]: { body: [] },
      'POST /api/demo/active': { body: {} },
    };
    const { browser, page, calls } = await open(theme, routes);
    const shot = shooter(theme, 'ana', page);
    await safely('landing', async () => {
      await shot('01-landing-slide1', { full: false });
      for (const n of [2, 3, 4]) { await page.getByRole('button', { name: `Go to slide ${n} of 4` }).click(); await shot(`01-landing-slide${n}`, { full: false }); }
      await btn(page, 'Start an experiment').click();
      await shot('02-signup');
      await page.getByLabel('Email').fill('ana@example.invalid');
      await page.getByLabel('Password', { exact: true }).fill('fake-review-only');
      await shot('02-signup-filled');
      await page.getByTestId('submit-action').click();
    });
    await safely('onboarding', async () => {
      await shot('03-onboard-0-intro');
      await btn(page, 'Start').click();
      await shot('03-onboard-1-age-empty');
      await page.getByRole('radio', { name: '25–34' }).click();
      await shot('03-onboard-1-age');
      await btn(page, 'Continue').click();
      await shot('03-onboard-2-sleep-empty');
      await page.locator('input[type=time]').nth(0).fill('23:30');
      await page.locator('input[type=time]').nth(1).fill('07:00');
      await shot('03-onboard-2-sleep');
      await btn(page, 'Continue').click();
      await shot('03-onboard-3-hours');
      await btn(page, 'Continue').click();
      await page.getByRole('radio', { name: /Lightly active/ }).click();
      await shot('03-onboard-4-move');
      await btn(page, 'Continue').click();
      await page.getByRole('checkbox', { name: 'More energy in the morning' }).click();
      await page.getByRole('checkbox', { name: 'Fall asleep faster' }).click();
      await shot('03-onboard-5-goals');
      await btn(page, 'Continue').click();
      await page.getByRole('checkbox', { name: 'Coffee around 9am' }).click();
      await page.getByRole('checkbox', { name: 'Walk after dinner' }).click();
      await shot('03-onboard-6-habits');
      await btn(page, 'Continue').click();
      await shot('03-onboard-7-limits');
      await btn(page, 'Continue').click();
      await shot('03-onboard-8-summary');
      await btn(page, 'Save my rhythm').click();
    });
    await safely('guide', async () => {
      await shot('04-guide-1');
      await page.getByRole('radio', { name: 'Yes, I made the change' }).click();
      await shot('04-guide-2');
      await page.getByRole('radio', { name: 'Morning energy: 7' }).click();
      await shot('04-guide-3');
      await btn(page, 'Save example').click();
    });
    await safely('ask', async () => {
      await shot('05-today-empty-ask');
      await page.getByLabel('Your question or goal').fill('Does a 20-minute walk after dinner improve my morning energy?');
      await shot('05-ask-typed');
      await btn(page, 'Design experiment').click();
      await shot('05-ask-working', { settle: 300, full: false });
      await page.getByText('What do you think will happen?').waitFor();
      await shot('06-guess');
      await page.getByLabel(/Your guess for/).fill('12');
      await shot('06-guess-filled');
      await btn(page, 'Show prediction').click();
      await shot('07-plan');
      await btn(page, 'Why?').click();
      await shot('07-plan-why');
      await btn(page, 'Start this experiment').click();
      await shot('08-today-day1');
    });
    await safely('tabs', async () => {
      await tab(page, 'Progress'); await shot('09-progress-new');
      await tab(page, 'History'); await shot('09-history-empty');
      await tab(page, 'You'); await shot('09-you');
    });
    if (calls.some(c => /propose$/.test(c)) === false) problems.push('ana: no propose call');
    await browser.close();
  },
  async raj(theme) {
    let recorded = seq(3); let exp: any = running(4);
    const timeline = () => ({ ...timelineFixture(exp, { recorded, nextDayAt: tomorrow }), baseline_summary: exp.progress.phase === 'intervention' ? NORMAL : null });
    const routes: Routes = { ...profileOk, ...hist,
      'GET /api/experiments?status=active': () => ({ body: [exp] }),
      [`GET /api/experiments/${ID}/progress`]: () => ({ body: timeline() }),
      [`GET /api/experiments/${ID}/checkins`]: () => ({ body: recorded.map(checkin) }),
      [`POST /api/experiments/${ID}/checkins`]: () => { recorded = [...recorded, exp.progress.day_number]; return { body: checkin(exp.progress.day_number) }; },
      'GET /api/experiments/progress-summary': { body: { kept: [], metrics: [], example: null } },
    };
    const { browser, page } = await open(theme, routes);
    const shot = shooter(theme, 'raj', page);
    await signIn(page);
    await safely('today', async () => {
      await page.getByRole('button', { name: /Check in now/ }).waitFor();
      await shot('01-today-day4');
      await page.getByRole('button', { name: /Check in now/ }).click();
      await page.getByLabel('Optional note').waitFor();
      await shot('02-checkin');
      await btn(page, 'Save check-in').click();
      await shot('02-checkin-validation', { full: false });
      await page.getByRole('radio', { name: 'Yes, I made the change' }).click();
      await page.getByRole('radio', { name: 'Morning energy: 7' }).click();
      await page.getByRole('radio', { name: 'Sleep quality: 6' }).click();
      await shot('02-checkin-answered');
      const t0 = Date.now();
      await btn(page, 'Save check-in').click();
      await page.getByRole('button', { name: 'Continue' }).waitFor();
      await shot('03-celebration', { settle: 650, full: false });
      await btn(page, 'Continue').click();
      await shot('04-today-done');
    });
    await safely('detail', async () => {
      await page.getByRole('button', { name: 'See your experiment' }).or(page.getByRole('link', { name: 'See your experiment' })).first().click();
      await shot('05-experiment-detail');
      await page.getByText('‹ Today').first().click();
    });
    await safely('tabs', async () => {
      await tab(page, 'Progress'); await shot('06-progress');
      await tab(page, 'Ask'); await shot('07-ask-while-running');
      await tab(page, 'History'); await shot('08-history-empty');
      await tab(page, 'You'); await shot('09-you');
      await page.getByRole('button', { name: /Daily reminders/ }).click(); await shot('10-reminders');
    });
    await browser.close();
  },
  async rajday3(theme) {
    let recorded = seq(2); let exp: any = running(3);
    const routes: Routes = { ...profileOk, ...hist,
      'GET /api/experiments?status=active': () => ({ body: [exp] }),
      [`GET /api/experiments/${ID}/progress`]: () => ({ body: timelineFixture(exp, { recorded, nextDayAt: tomorrow }) }),
      [`GET /api/experiments/${ID}/checkins`]: () => ({ body: recorded.map(checkin) }),
      [`POST /api/experiments/${ID}/checkins`]: () => { recorded = [1, 2, 3]; return { body: checkin(3) }; },
    };
    const { browser, page } = await open(theme, routes);
    const shot = shooter(theme, 'raj-day3', page);
    await signIn(page);
    await safely('day3', async () => {
      await page.getByRole('button', { name: /Check in now/ }).waitFor();
      await shot('01-today');
      await page.getByRole('button', { name: /Check in now/ }).click();
      await page.getByLabel('Optional note').waitFor();
      await shot('02-checkin');
      await page.getByRole('radio', { name: 'Morning energy: 6' }).click();
      await page.getByRole('radio', { name: 'Sleep quality: 7' }).click();
      await btn(page, 'Save check-in').click();
      await page.getByRole('button', { name: 'Continue' }).waitFor();
      await shot('03-celebration', { settle: 650, full: false });
      await btn(page, 'Continue').click();
      await shot('04-today-baseline-done');
    });
    await browser.close();
  },
  async mei(theme) {
    let recorded = seq(9); let exp: any = running(10); let done = false; let written = false; let kept = false;
    const ended = () => ({ ...exp, progress: { ...exp.progress, state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } });
    const summary = () => ({ ...SUMMARY, kept: kept ? [{ experiment_id: ID, question: F.experiment.question, habit: 'Walk for 20 minutes', completed_at: '2026-10-28T09:00:00Z' }] : [] });
    const routes: Routes = { ...profileOk,
      'GET /api/experiments?status=active': () => ({ body: done ? [] : [exp] }),
      [`GET /api/experiments/${ID}/progress`]: () => ({ body: timelineFixture(exp, { recorded, nextDayAt: exp.progress.state === 'ended' ? null : tomorrow }) }),
      [`GET /api/experiments/${ID}/checkins`]: () => ({ body: recorded.map(checkin) }),
      [`POST /api/experiments/${ID}/checkins`]: () => { recorded = seq(10); return { body: checkin(10) }; },
      [`POST /api/experiments/${ID}/complete`]: () => { done = true; return { body: report() }; },
      [`GET /api/experiments/${ID}/report`]: () => ({ body: report(written) }),
      [`POST /api/experiments/${ID}/report`]: () => { written = true; return { delay: 800, body: report(true) }; },
      [`POST /api/experiments/${ID}/outcome`]: () => { kept = true; return { body: { choice: 'keep' } }; },
      'GET /api/experiments/capacity': { body: { active_count: 0, limit: 3, can_start: true } },
      'GET /api/experiments/progress-summary': () => ({ body: summary() }),
      'GET /api/experiments/calibration': { body: CALIBRATION },
      'GET /api/experiments?status=completed': { body: [F.completedExperiment, { ...F.completedExperiment, id: 'a', question: 'Does morning light help my energy?', completed_at: '2026-10-05T10:00:00Z' }] },
      'GET /api/experiments/a/report': { body: F.labReport },
      'POST /api/demo/reset': { body: seededReport },
    };
    const { browser, page } = await open(theme, routes);
    const shot = shooter(theme, 'mei', page);
    await signIn(page);
    await safely('day10', async () => {
      await page.getByRole('button', { name: /Check in now/ }).waitFor();
      await shot('01-today-day10');
      await page.getByRole('button', { name: /Check in now/ }).click();
      await page.getByLabel('Optional note').waitFor();
      await page.getByRole('radio', { name: 'Yes, I made the change' }).click();
      await page.getByRole('radio', { name: 'Morning energy: 7' }).click();
      await page.getByRole('radio', { name: 'Sleep quality: 8' }).click();
      await btn(page, 'Save check-in').click();
      await page.getByRole('button', { name: 'Continue' }).waitFor();
      await shot('02-celebration-last', { settle: 650, full: false });
      await btn(page, 'Continue').click();
      await shot('03-today-last-day-done');
      await page.getByRole('button', { name: 'See your experiment' }).or(page.getByRole('link', { name: 'See your experiment' })).first().click();
      await shot('04-detail-last-day');
      exp = ended();
      await page.getByText('‹ Today').first().click();
      await shot('05-today-ended');
      await page.getByRole('button', { name: 'See results' }).or(page.getByRole('link', { name: 'See results' })).first().click();
      await shot('06-detail-ended');
      await page.getByRole('button', { name: 'See results', exact: true }).first().click();
      await shot('07-finish-confirm', { full: false });
      await btn(page, 'Yes, finish').click();
      await shot('08-day10-choice');
      await page.getByRole('button', { name: /See full Lab Report/ }).or(page.getByRole('link', { name: /See full Lab Report/ })).first().click();
      await shot('09-report-first-look');
      await btn(page, 'Reveal my result').click();
      await shot('10-report-revealed');
      await btn(page, 'Write my report').click();
      await shot('11-report-writing', { settle: 200, full: false });
      await page.getByText('What you learned about you').waitFor();
      await page.getByRole('button', { name: 'Run this experiment' }).waitFor();
      await shot('12-report-written');
    });
    await safely('progress-history', async () => {
      await tab(page, 'History');
      await shot('13-history');
      await page.getByRole('button', { name: `Open Lab Report for ${F.experiment.question}` }).click();
      await shot('14-report-from-history', { full: false });
      await tab(page, 'Progress');
      await shot('15-progress-compared');
      await tab(page, 'You');
      await page.getByRole('button', { name: /See an example/ }).click();
      await shot('16-example');
      await btn(page, 'Explore a completed example').click();
      await shot('17-example-report');
      await tab(page, 'Today');
      await shot('18-today-after-finish');
    });
    await browser.close();
  },
  async meikeep(theme) {
    let done = true; let kept = false;
    const routes: Routes = { ...profileOk,
      'GET /api/experiments?status=active': () => ({ body: done ? [ { ...running(10), progress: { ...running(10).progress, state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } } ] : [] }),
      [`GET /api/experiments/${ID}/progress`]: () => { const e = { ...running(10), progress: { ...running(10).progress, state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } }; return { body: timelineFixture(e, { recorded: seq(10) }) }; },
      [`GET /api/experiments/${ID}/checkins`]: { body: seq(10).map(checkin) },
      [`POST /api/experiments/${ID}/complete`]: () => { done = false; return { body: report() }; },
      [`POST /api/experiments/${ID}/outcome`]: () => { kept = true; return { body: { choice: 'keep' } }; },
      'GET /api/experiments/progress-summary': () => ({ body: { ...SUMMARY, kept: kept ? [{ experiment_id: ID, question: F.experiment.question, habit: 'Walk for 20 minutes', completed_at: '2026-10-28T09:00:00Z' }] : [] } }),
      'POST /api/experiments/propose': { body: { ...F.proposeResponse, personal_guess_available: true } },
    };
    const { browser, page } = await open(theme, routes);
    const shot = shooter(theme, 'mei-keep', page);
    await signIn(page);
    await safely('keep', async () => {
      await page.getByRole('button', { name: 'See results' }).or(page.getByRole('link', { name: 'See results' })).first().click();
      await page.getByRole('button', { name: 'See results', exact: true }).first().click();
      await btn(page, 'Yes, finish').click();
      await page.getByRole('button', { name: /Keep this habit/ }).click();
      await shot('01-progress-kept');
      await tab(page, 'Today');
      await shot('02-today-next-experiment');
    });
    await browser.close();
  },
  async states(theme) {
    // Empty, error, offline, refused, limit, sample and two running.
    const exp = running(4); const tl = { ...timelineFixture(exp, { recorded: seq(3), nextDayAt: tomorrow }), baseline_summary: NORMAL };
    const down = { status: 503, body: { detail: 'Service unavailable' } };
    const base: Routes = { ...profileOk, ...active([exp]), [`GET /api/experiments/${ID}/progress`]: { body: tl }, [`GET /api/experiments/${ID}/checkins`]: { body: seq(3).map(checkin) }, ...hist };

    {
      const { browser, page } = await open(theme, { ...base, 'GET /api/experiments/progress-summary': down, 'GET /api/experiments?status=completed': down, 'GET /api/experiments/calibration': down });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('errors', async () => {
        await page.getByRole('button', { name: /Check in now/ }).waitFor();
        await tab(page, 'Progress'); await shot('progress-error');
        await tab(page, 'History'); await shot('history-error');
      });
      await browser.close();
    }
    {
      const { browser, context, page } = await open(theme, { ...base, 'GET /api/experiments?status=completed': { body: [F.completedExperiment] }, [`GET /api/experiments/${ID}/report`]: { body: report() }, 'GET /api/experiments/calibration': { body: CALIBRATION } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('offline', async () => {
        await page.getByRole('button', { name: /Check in now/ }).waitFor();
        await tab(page, 'History'); await page.waitForTimeout(500);
        await tab(page, 'Today');
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await shot('today-offline');
        await page.getByRole('button', { name: /Check in now/ }).click({ timeout: 2500 }).catch(() => problems.push('offline: check-in button disabled (expected?)'));
        await shot('checkin-offline', { full: false });
        await tab(page, 'Progress').catch(() => undefined); await shot('progress-offline');
        await tab(page, 'History').catch(() => undefined); await shot('history-offline');
      });
      await browser.close();
    }
    {
      const { browser, context, page } = await open(theme, { ...profileOk, ...active([]), ...hist });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('fresh offline', async () => {
        await page.getByLabel('Your question or goal').waitFor();
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await shot('ask-offline');
        await tab(page, 'History'); await shot('history-offline-never-loaded');
        await tab(page, 'Progress'); await shot('progress-offline-never-loaded');
      });
      await browser.close();
    }
    {
      const { browser, page } = await open(theme, { ...profileOk, ...active([]), ...hist,
        'POST /api/experiments/propose': { body: { personal_guess_available: false, proposal: null, prediction: null, safety: { allowed: false, reason: "This sounds like a question for a clinician rather than a habit experiment.", suggested_alternative: 'Does a regular bedtime help me feel rested?' }, classification: { category: 'other', intent: 'medical', risk: 'high' } } } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('refused', async () => {
        await page.getByLabel('Your question or goal').fill('Should I stop taking my medication to sleep better?');
        await btn(page, 'Design experiment').click();
        await page.getByText(/gentler experiment/).waitFor();
        await shot('ask-refused');
      });
      await browser.close();
    }
    {
      const { browser, page } = await open(theme, { ...profileOk, ...active([]), ...hist, 'POST /api/experiments/propose': { status: 503, body: { detail: 'Service unavailable' } } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('propose error', async () => {
        await page.getByLabel('Your question or goal').fill('Does a walk help me sleep better?');
        await btn(page, 'Design experiment').click();
        await page.getByRole('button', { name: 'Retry' }).waitFor();
        await shot('ask-error');
      });
      await browser.close();
    }
    {
      const { browser, page } = await open(theme, { ...profileOk, 'GET /api/experiments?status=active': down, ...hist });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('today error', async () => { await page.getByRole('button', { name: 'Try again' }).waitFor(); await shot('today-error'); });
      await browser.close();
    }
    {
      const ended = { ...exp, progress: { ...exp.progress, state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } };
      const { browser, page } = await open(theme, { ...base, ...active([ended]), [`GET /api/experiments/${ID}/progress`]: { body: timelineFixture(ended, { recorded: seq(10) }) }, [`GET /api/experiments/${ID}/checkins`]: { body: seq(10).map(checkin) }, [`POST /api/experiments/${ID}/complete`]: down, [`GET /api/experiments/${ID}/report`]: { status: 404, body: { detail: 'none' } } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('finish error', async () => {
        await page.getByRole('button', { name: 'See results' }).or(page.getByRole('link', { name: 'See results' })).first().click();
        await page.getByRole('button', { name: 'See results', exact: true }).first().click();
        await btn(page, 'Yes, finish').click();
        await page.waitForTimeout(600);
        await shot('finish-error', { full: false });
      });
      await browser.close();
    }
    {
      const sample = { ...running(4), is_seeded: true, id: ID };
      const { browser, page } = await open(theme, { ...base, ...active([sample]), [`GET /api/experiments/${ID}/progress`]: { body: timelineFixture(sample, { recorded: seq(3), nextDayAt: tomorrow }) }, 'GET /api/experiments/progress-summary': { body: EXAMPLE_SUMMARY } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('sample', async () => { await page.getByRole('button', { name: /Check in now/ }).waitFor(); await shot('today-sample'); await tab(page, 'Progress'); await shot('progress-sample'); });
      await browser.close();
    }
    {
      const tl2 = timelineFixture(SECOND, { recorded: seq(3), nextDayAt: tomorrow });
      const { browser, page } = await open(theme, { ...base, ...active([exp, SECOND]), [`GET /api/experiments/${SECOND.id}/progress`]: { body: tl2 }, [`GET /api/experiments/${SECOND.id}/checkins`]: { body: [] }, 'GET /api/experiments/capacity': { body: { active_count: 2, limit: 3, can_start: true } }, 'GET /api/checkins/today': { body: TODAY_COMBINED } });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('two', async () => {
        await btn(page, 'Check in for today').waitFor();
        await shot('today-two-running');
        await btn(page, 'Check in for today').click();
        await shot('checkin-combined');
      });
      await browser.close();
    }
    {
      const { browser, page } = await open(theme, { ...profileOk, 'GET /api/experiments?status=active': { delay: 4000, body: [exp] }, ...hist });
      const shot = shooter(theme, 'state', page); await signIn(page);
      await safely('loading', async () => { await shot('today-loading', { full: false, settle: 800 }); });
      await browser.close();
    }
    {
      const { browser, page } = await open(theme, base);
      const shot = shooter(theme, 'state', page);
      await safely('auth', async () => { await btn(page, 'Sign in').click(); await shot('signin'); });
      await browser.close();
    }
  },
  async large(theme) {
    // A simulation of about 135% system text: each text node scaled, with no caps. Native honours maxFontSizeMultiplier.
    const exp = running(4); const tl = { ...timelineFixture(exp, { recorded: seq(3), nextDayAt: tomorrow }), baseline_summary: NORMAL };
    const { browser, page } = await open(theme, { ...profileOk, ...active([exp]), [`GET /api/experiments/${ID}/progress`]: { body: tl }, [`GET /api/experiments/${ID}/checkins`]: { body: seq(3).map(checkin) }, ...hist });
    const shot = shooter(theme, 'large', page);
    await safely('large', async () => {
      await shot('landing', { large: true, full: false });
      await signIn(page);
      await page.getByRole('button', { name: /Check in now/ }).waitFor();
      await shot('today', { large: true });
      await page.getByRole('button', { name: /Check in now/ }).click();
      await page.getByLabel('Optional note').waitFor();
      await shot('checkin', { large: true });
    });
    await browser.close();
  },
  async reduced(theme) {
    const { browser, page } = await open(theme, { ...profileOk, ...active([]), ...hist }, { reduced: true });
    const shot = shooter(theme, 'reduced', page);
    await safely('reduced', async () => {
      await shot('landing-t0', { full: false });
      await page.waitForTimeout(5500);
      await shot('landing-t6s', { full: false, settle: 0 });
      const slide = await page.getByRole('button', { name: 'Go to slide 1 of 4' }).getAttribute('aria-selected');
      audits.push({ theme, screen: 'reduced-landing', slide1Selected: slide, pauseShown: await page.getByRole('button', { name: /slides/ }).count() });
    });
    await browser.close();
  },
};

for (const name of Object.keys(SCENARIOS)) {
  if (only && !only.includes(name)) continue;
  for (const theme of themes) {
    if ((name === 'large' || name === 'reduced') && theme === 'dark') continue;
    const t = Date.now();
    await safely(`${name}/${theme}`, () => SCENARIOS[name](theme));
    console.log(`${name}/${theme} ${Date.now() - t}ms`);
  }
}
server.close();
mkdirSync(AUDIT, { recursive: true });
writeFileSync(join(AUDIT, `audit${process.env.TAG ?? ''}.json`), JSON.stringify(audits, null, 1));
writeFileSync(join(AUDIT, `texts${process.env.TAG ?? ''}.json`), JSON.stringify(texts, null, 1));
writeFileSync(join(AUDIT, `problems${process.env.TAG ?? ''}.json`), JSON.stringify([...new Set(problems)], null, 1));
console.log('problems:', [...new Set(problems)]);
