import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const SUMMARY = 'GET /api/experiments/progress-summary';
const run = (id: string, question: string, baseline: number | null, result: number | null, percent: number | null) => ({ experiment_id: id, question, completed_at: '2026-10-20T10:00:00Z', baseline_mean: baseline, result_mean: result, percent_change: percent });
const empty = { metrics: [], kept: [], example: null };
const ID = experiment.id;
const ended = { ...experiment, status: 'active', started_at: '2026-10-25T10:00:00Z', progress: { state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, total_days: 10, days_remaining: 0, started_at: '2026-10-25T10:00:00Z', ends_at: '2026-11-04T10:00:00Z' } };
let routes: Record<string, { status?: number; body: unknown }>;
let calls: { key: string; body?: unknown }[];

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  routes = {
    'GET /api/profile': { body: profile },
    'GET /api/experiments?status=active': { body: [] },
    [SUMMARY]: { body: empty },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    calls.push({ key, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    const reply = routes[key];
    if (!reply) return { ok: false, status: 404, json: async () => ({ detail: `Not mocked: ${key}` }) } as Response;
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const pressTab = async (name: string) => {
  const tab = await screen.findByRole('tab', { name });
  await act(async () => { fireEvent.press(tab); });
};
const openProgress = async () => { render(<MobileApp />); await pressTab('Progress'); };

describe('the Progress tab', () => {
  test('compares normal and result, experiment by experiment, and how normal has moved', async () => {
    routes[SUMMARY] = { body: { ...empty, metrics: [{ key: 'energy', label: 'Morning energy', type: 'scale', normal_change: 1.25, runs: [run('a', 'Does a walk help?', 5, 6, 20), run('b', 'Does less coffee help?', 6.25, 7.5, 20)] }] } };
    await openProgress();
    const card = await screen.findByTestId('metric-energy');
    expect(within(card).getByText('Morning energy')).toBeVisible();
    expect(within(card).getByText('Does a walk help?')).toBeVisible();
    expect(within(card).getByText('Normal 5 → with the change 6 (+20%)')).toBeVisible();
    expect(within(card).getByText('Normal 6.3 → with the change 7.5 (+20%)')).toBeVisible();
    expect(within(card).getByText('Your normal has moved +1.3 since your first experiment.')).toBeVisible();
    expect(screen.getByText('Changing several things over time means this shows trends, not proof.')).toBeVisible();
  });

  test('with one experiment it makes no claim about movement', async () => {
    routes[SUMMARY] = { body: { ...empty, metrics: [{ key: 'energy', label: 'Energy', type: 'scale', normal_change: null, runs: [run('a', 'Walk?', 5, 6, 20)] }] } };
    await openProgress();
    await screen.findByTestId('metric-energy');
    expect(screen.queryByText(/Your normal has moved/)).toBeNull();
  });

  test('a missing number stays missing', async () => {
    routes[SUMMARY] = { body: { ...empty, metrics: [{ key: 'energy', label: 'Energy', type: 'scale', normal_change: null, runs: [run('a', 'Walk?', null, 6, null)] }] } };
    await openProgress();
    expect(await screen.findByText('Normal not enough data → with the change 6')).toBeVisible();
  });

  test('yes-or-no metrics read as a share of days', async () => {
    routes[SUMMARY] = { body: { ...empty, metrics: [{ key: 'walked', label: 'Walked', type: 'boolean', normal_change: null, runs: [run('a', 'Walk?', 0.25, 0.75, 200)] }] } };
    await openProgress();
    expect(await screen.findByText('Normal 25% of days → with the change 75% of days (+200%)')).toBeVisible();
  });

  test('the sample is a labelled Example, kept apart, and gone once there are real numbers', async () => {
    routes[SUMMARY] = { body: { ...empty, example: { question: 'Sample question?', metrics: [{ key: 'energy', label: 'Energy', type: 'scale', normal_change: null, runs: [run('example', 'Sample question?', 5, 6, 20)] }] } } };
    await openProgress();
    const panel = await screen.findByTestId('progress-example');
    expect(within(panel).getByText('Example')).toBeVisible();
    expect(within(panel).getByText('Invented check-ins. Never counted.')).toBeVisible();
    expect(within(panel).getByText('Normal 5 → with the change 6 (+20%)')).toBeVisible();
    expect(screen.queryByTestId('metric-energy')).toBeNull();
    screen.unmount();
    routes[SUMMARY] = { body: { ...empty, metrics: [{ key: 'real', label: 'Real', type: 'scale', normal_change: null, runs: [run('a', 'Real?', 1, 2, 100)] }] } };
    await openProgress();
    await screen.findByTestId('metric-real');
    expect(screen.queryByTestId('progress-example')).toBeNull();
    expect(screen.queryByText('Example')).toBeNull();
  });

  test('lists Habits I kept', async () => {
    routes[SUMMARY] = { body: { ...empty, kept: [{ experiment_id: 'a', question: 'Walk?', habit: 'Walk after dinner', completed_at: '2026-10-20T10:00:00Z' }] } };
    await openProgress();
    expect(await screen.findByRole('header', { name: 'Habits I kept' })).toBeVisible();
    expect(screen.getByText('Walk after dinner')).toBeVisible();
  });

  test('a failed read says so and retries, and makes no paid call', async () => {
    routes[SUMMARY] = { status: 503, body: { detail: 'Down' } };
    await openProgress();
    expect(await screen.findByRole('alert')).toBeVisible();
    routes[SUMMARY] = { body: empty };
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(calls.filter(call => /propose|\/report$/.test(call.key))).toEqual([]);
  });
});

describe('finishing on day 10', () => {
  const finish = async () => {
    routes['GET /api/experiments?status=active'] = { body: [ended] };
    routes[`GET /api/experiments/${ID}/progress`] = { body: timelineFixture(ended as never, { recorded: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }) };
    routes[`GET /api/experiments/${ID}/checkins`] = { body: [] };
    routes[`POST /api/experiments/${ID}/complete`] = { body: writtenLabReport };
    routes[`POST /api/experiments/${ID}/outcome`] = { body: { experiment_id: ID, choice: 'keep' } };
    render(<MobileApp />);
    const open = await screen.findByRole('button', { name: 'See your results' });
    await act(async () => { fireEvent.press(open); });
    await screen.findByRole('button', { name: /^Keep this habit/ });
  };

  test('gives the result in one sentence, then guess, prediction and what happened', async () => {
    await finish();
    expect(screen.getByText('Your guess')).toBeVisible();
    expect(screen.getByText('We predicted')).toBeVisible();
    expect(screen.getByText('What happened')).toBeVisible();
    expect(screen.getByText('A short personal experiment shows a pattern, not proof.')).toBeVisible();
    for (const name of [/^Keep this habit/, /^Try a variation/, /^Test something new/]) expect(screen.getByRole('button', { name })).toBeVisible();
  });

  test('makes no paid call, and leaves Write my report in the Lab Report', async () => {
    await finish();
    expect(calls.filter(call => call.key.endsWith('/report') && call.key.startsWith('POST'))).toEqual([]);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'See full Lab Report' })); });
    expect(await screen.findByRole('button', { name: 'Back to today' })).toBeVisible();
  });

  test('Keep stores the choice once and goes to Progress', async () => {
    await finish();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Keep this habit/ })); });
    expect(calls.filter(call => call.key.endsWith('/outcome')).map(call => call.body)).toEqual([{ choice: 'keep' }]);
    expect(await screen.findByRole('tab', { name: 'Progress', selected: true })).toBeVisible();
  });

  test('if Keep fails, nothing moves and it can be tried again', async () => {
    await finish();
    routes[`POST /api/experiments/${ID}/outcome`] = { status: 503, body: { detail: 'Down' } };
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Keep this habit/ })); });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't save your choice/);
    expect(screen.getByRole('button', { name: /^Keep this habit/ })).toBeEnabled();
  });

  test('Try a variation opens Ask with the same question to edit', async () => {
    await finish();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Try a variation/ })); });
    expect(await screen.findByRole('tab', { name: 'Ask', selected: true })).toBeVisible();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe(experiment.question);
    expect(calls.filter(call => call.key.endsWith('/propose'))).toEqual([]);
  });

  test('Test something new opens an empty Ask', async () => {
    await finish();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Test something new/ })); });
    expect(await screen.findByRole('tab', { name: 'Ask', selected: true })).toBeVisible();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe('');
  });
});
