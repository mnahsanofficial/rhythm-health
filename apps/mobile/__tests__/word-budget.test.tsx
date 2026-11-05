import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Experiment } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, labReport, profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { greyBody, visibleLines, wordsOn } from './support/word-budget';

/**
 * The text budget (docs/design/05-design-system.md). Each screen's count, measured with fixture data.
 * If this fails, cut words or move them behind a tap: raising a number is a design decision, not a fix.
 */
const BUDGET = {
  'today, recorded': 23,
  'today, due': 26,
  'today, two running': 42,
  'experiment screen': 35,
  'check-in, the change': 15,
  'check-in, a question': 12,
  'check-in, review': 20,
  'combined, the change': 16,
  'combined, a question': 16,
  'combined, review': 25,
  ask: 40,
  'plan, the change': 12,
  guess: 15,
  'plan, the reveal': 16,
  'plan, the days': 25,
  progress: 40,
  history: 30,
  'lab report': 50,
  'lab report, compared': 62,
} as const;

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const on = (day: number, phase: 'baseline' | 'intervention', extra: Partial<Experiment> = {}): Experiment => ({
  ...experiment, status: 'active', ...extra,
  progress: { ...experiment.progress, state: 'in_progress', day_number: day, total_days: 10, days_remaining: 10 - day, phase, phase_day: phase === 'baseline' ? day : day - 3, phase_days: phase === 'baseline' ? 3 : 7, started_at: '2026-10-01T09:00:00Z' },
});
const summary = { metrics: [{ key: 'energy', label: 'Morning energy', type: 'scale', normal_change: 1.25, runs: [{ experiment_id: 'a', question: 'Does a walk help?', baseline_mean: 5, test_mean: 6, percent_change: 20, completed_at: '2026-10-20T10:00:00Z' }] }], kept: [{ experiment_id: 'k', habit: 'Walk for 20 minutes', question: 'Does a walk help?' }], example: null };
let routes: Record<string, unknown>;

function install(list: Experiment[], recorded: number[] = []) {
  routes = {
    'GET /api/profile': profile, 'GET /api/experiments?status=active': list, 'GET /api/experiments/progress-summary': summary, 'GET /api/experiments?status=completed': [labReport.experiment],
    'GET /api/experiments/calibration': { points: [], trend: null, average_off_by_points: null, example: null },
    'POST /api/experiments/propose': { ...proposeResponse, personal_guess_available: true },
    'GET /api/experiments/capacity': { active: list.length, limit: 3, can_start: list.length < 3 },
    [`GET /api/experiments/${labReport.experiment.id}/report`]: writtenLabReport,
  };
  for (const item of list) {
    routes[`GET /api/experiments/${item.id}/progress`] = timelineFixture(item, { recorded, nextDayAt: '2026-11-07T18:00:00Z' });
    routes[`GET /api/experiments/${item.id}/checkins`] = recorded.map(day => ({ id: `c${day}`, experiment_id: item.id, day_number: day, phase: 'baseline', intervention_completed: false, metric_values: { morning_energy: 6, sleep_quality: 6 }, note: null, created_at: '2026-10-31T10:00:00Z', updated_at: '2026-10-31T10:00:00Z' }));
  }
}

beforeEach(() => {
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake', user: { id: 'u', email: 'a@example.invalid' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  global.fetch = jest.fn(async (url, options) => {
    const parsed = new URL(String(url)); const method = options?.method ?? 'GET';
    const body = routes[`${method} ${parsed.pathname}${parsed.search}`] ?? routes[`${method} ${parsed.pathname}`];
    if (body === undefined) throw new Error(`Unexpected fake request ${method} ${parsed.pathname}`);
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
const press = async (node: Parameters<typeof fireEvent.press>[0]) => { await act(async () => { fireEvent.press(node); }); await settle(); };
const tab = async (name: string) => press(await screen.findByRole('tab', { name }));
function expectWithin(name: keyof typeof BUDGET, tree: unknown) {
  const words = wordsOn(tree);
  if (words > BUDGET[name]) throw new Error(`${name}: ${words} words, budget ${BUDGET[name]}\n${visibleLines(tree).map(line => line.text).join('\n')}`);
  expect(greyBody(tree)).toEqual([]);
}
const openToday = async () => { const view = render(<MobileApp />); await screen.findByText(experiment.question); await settle(); return view; };

describe('main-flow screens stay within their word budget', () => {
  test('Today, recorded', async () => {
    install([on(1, 'baseline')], [1]); const view = await openToday();
    expectWithin('today, recorded', view.toJSON());
  });

  test('Today, due, and the experiment screen', async () => {
    install([on(4, 'intervention')], [1, 2, 3]); const view = await openToday();
    expectWithin('today, due', view.toJSON());
    await press(screen.getByRole('button', { name: 'See your experiment' }));
    await press(screen.getByRole('button', { name: 'Not now' }));
    expectWithin('experiment screen', view.toJSON());
  });

  test('every step of a test-day check-in', async () => {
    install([on(4, 'intervention')]); const view = await openToday();
    await press(screen.getByRole('button', { name: 'Check in now, day 4' })); await settle();
    expectWithin('check-in, the change', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    expectWithin('check-in, a question', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    expectWithin('check-in, a question', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Sleep quality: 7' }));
    expectWithin('check-in, review', view.toJSON());
  });

  test('every step of a combined check-in', async () => {
    const a = on(2, 'baseline', { id: 'first-id', question: 'Does a 20-minute walk after dinner improve my morning energy?' });
    const b = on(5, 'intervention', { id: 'second-id', question: 'Does less caffeine after lunch improve my focus at work?' });
    install([a, b]);
    const scale = { type: 'scale', min: 1, max: 10, primary: false, min_label: null, max_label: null };
    routes['GET /api/checkins/today'] = {
      revision: 'r', note: null, all_recorded: false,
      experiments: [a, b].map((item, index) => ({ id: item.id, question: item.question, action: index ? 'No caffeine after lunch' : 'Walk for 20 minutes', timing: 'After lunch', day_number: index ? 5 : 2, total_days: 10, phase: index ? 'intervention' : 'baseline', change_required: index === 1, change_made: null, recorded: false })),
      questions: [
        { id: 'q1', experiment_ids: ['first-id', 'second-id'], value: null, metric: { key: 'energy', label: 'Morning energy', ...scale } },
        { id: 'q2', experiment_ids: ['second-id'], value: null, metric: { key: 'focus', label: 'Focus', ...scale } },
      ],
    };
    const view = render(<MobileApp />); await settle(); await settle();
    expectWithin('today, two running', view.toJSON());
    await press(screen.getAllByRole('button', { name: /^Check in now, day/ })[0]); await settle();
    expectWithin('combined, a question', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    expectWithin('combined, the change', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    expectWithin('combined, a question', view.toJSON());
    await press(screen.getByRole('radio', { name: 'Focus: 7' }));
    expectWithin('combined, review', view.toJSON());
  });

  test('Ask, the guess and the plan', async () => {
    install([]); const view = render(<MobileApp />); await tab('Ask'); await settle();
    expectWithin('ask', view.toJSON());
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), proposeResponse.proposal!.question);
    await press(screen.getByRole('button', { name: 'Design experiment' })); await settle();
    expectWithin('plan, the change', view.toJSON());
    await press(screen.getByRole('button', { name: 'Next' }));
    expectWithin('guess', view.toJSON());
    fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '10');
    await press(screen.getByRole('button', { name: 'Show prediction' })); await settle();
    expectWithin('plan, the reveal', view.toJSON());
    await press(screen.getByRole('button', { name: 'Next' }));
    expectWithin('plan, the days', view.toJSON());
  });

  test('Progress, History and the Lab Report', async () => {
    install([on(4, 'intervention')], [1, 2, 3]); const view = await openToday();
    await tab('Progress'); await settle(); await settle();
    expectWithin('progress', view.toJSON());
    await tab('History'); await settle(); await settle();
    expectWithin('history', view.toJSON());
    await press(screen.getByRole('button', { name: `Open Lab Report for ${labReport.experiment.question}` })); await settle();
    expectWithin('lab report', view.toJSON());
    await press(screen.getByRole('button', { name: 'Compare with the prediction' }));
    expectWithin('lab report, compared', view.toJSON());
  });
});
