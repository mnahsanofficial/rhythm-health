import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { Experiment, LabReport } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { goTo } from './support/nav';
import { completedExperiment, experiment, labReport, profile, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const ACTIVE = '/api/experiments?status=active';
const COMPLETED = '/api/experiments?status=completed';
const CALIBRATION = '/api/experiments/calibration';
const RESET = 'POST /api/demo/reset';
const older: Experiment = { ...completedExperiment, id: 'older-id', question: 'Does tea after lunch change my focus?', completed_at: '2026-09-01T09:00:00Z' };
const newer: Experiment = completedExperiment;
const reportFor = (item: Experiment): LabReport => ({ ...labReport, experiment: item });
const seededReport: LabReport = { ...writtenLabReport, experiment: { ...completedExperiment, id: 'demo-id', is_seeded: true, question: 'Sample: does a morning walk help?' } };
const running: Experiment = { ...experiment, status: 'active', progress: {
  ...experiment.progress, state: 'in_progress', day_number: 2, phase: 'baseline', phase_day: 2, phase_days: 3, days_remaining: 8, started_at: '2026-11-01T09:00:00Z',
} };

type Reply = { status?: number; body?: unknown; network?: boolean };
let replies: Record<string, Reply[]>;
let defaults: Record<string, Reply>;
let calls: string[];
let listeners: Set<(state: AppStateStatus) => void>;
const count = (key: string) => calls.filter(call => call === key).length;
const queue = (key: string, ...items: Reply[]) => { replies[key] = [...(replies[key] ?? []), ...items]; };

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  replies = {}; calls = []; listeners = new Set();
  defaults = {
    'GET /api/profile': { body: profile },
    [`GET ${ACTIVE}`]: { body: [] },
    [`GET ${COMPLETED}`]: { body: [older, newer] },
    [`GET ${CALIBRATION}`]: { body: { points: [], average_off_by_points: null, trend: null } },
    [`GET /api/experiments/${newer.id}/report`]: { body: reportFor(newer) },
    [`GET /api/experiments/${older.id}/report`]: { body: reportFor(older) },
    [RESET]: { body: seededReport },
    [`GET /api/experiments/${running.id}/progress`]: { body: timelineFixture(running, {}) },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listeners.add(callback); return { remove: () => listeners.delete(callback) };
  });
  global.fetch = jest.fn(async (url, options) => {
    const path = String(url).replace('http://api.test.invalid:8001', '');
    const key = `${options?.method ?? 'GET'} ${path}`;
    calls.push(key);
    const reply = replies[key]?.shift() ?? defaults[key];
    if (!reply) throw new Error(`Unexpected fake request: ${key}`);
    if (reply.network) throw new TypeError('Network request failed');
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const press = (name: string | RegExp) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
async function openHistory() {
  render(<MobileApp />);
  await goTo('History');
}
const rows = () => screen.getAllByTestId('history-row');
const paid = () => calls.filter(call => call.endsWith('/propose') || (call.startsWith('POST') && call.endsWith('/report')));

describe('history', () => {
  test('lists completed experiments with the prediction, the outcome and the signal', async () => {
    await openHistory();
    expect(await screen.findByRole('header', { name: 'Your experiment history' })).toBeVisible();
    const row = within((await screen.findAllByTestId('history-row'))[0]);
    expect(row.getByText(newer.question)).toBeVisible();
    expect(await row.findByText('+21%')).toBeVisible();
    expect(row.getByText('+8–15%')).toBeVisible();
    expect(row.getByText('Likely signal')).toBeVisible();
    expect(row.getByRole('button', { name: `Open Lab Report for ${newer.question}` })).toBeVisible();
    expect(screen.getByText('2 completed experiments · newest first')).toBeVisible();
    expect(paid()).toEqual([]);
  });

  test('sorts by the finish date without another list read', async () => {
    await openHistory();
    await screen.findAllByTestId('history-row');
    expect(within(rows()[0]).getByText(newer.question)).toBeVisible();
    const reads = count(`GET ${COMPLETED}`);
    await press('Oldest first');
    expect(within(rows()[0]).getByText(older.question)).toBeVisible();
    expect(screen.getByText('2 completed experiments · oldest first')).toBeVisible();
    expect(count(`GET ${COMPLETED}`)).toBe(reads);
  });

  test('opens the native report and returns to history', async () => {
    await openHistory();
    await screen.findAllByTestId('history-row');
    await press(`Open Lab Report for ${older.question}`);
    expect(await screen.findByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
    expect(screen.getByRole('header', { name: older.question })).toBeVisible();
    await press('Back to history');
    expect(await screen.findByRole('header', { name: 'Your experiment history' })).toBeVisible();
    expect(paid()).toEqual([]);
  });

  test('a report written after opening is read fresh next time, not offered again', async () => {
    await openHistory();
    await screen.findAllByTestId('history-row');
    await press(`Open Lab Report for ${newer.question}`);
    await screen.findByRole('button', { name: 'Write my report' });
    defaults[`POST /api/experiments/${newer.id}/report`] = { body: { ...writtenLabReport, experiment: newer } };
    await press('Write my report');
    await screen.findByText(writtenLabReport.narrative!.summary);
    defaults[`GET /api/experiments/${newer.id}/report`] = { body: { ...writtenLabReport, experiment: newer } };
    await press('Back to history');
    await screen.findAllByTestId('history-row');
    await press(`Open Lab Report for ${newer.question}`);
    await screen.findByText(writtenLabReport.narrative!.summary);
    expect(screen.queryByRole('button', { name: 'Write my report' })).toBeNull();
    expect(count(`POST /api/experiments/${newer.id}/report`)).toBe(1);
  });

  test('empty history says what to do next and starts a question with no paid call', async () => {
    defaults[`GET ${COMPLETED}`] = { body: [] };
    await openHistory();
    expect(await screen.findByText('Nothing finished yet.')).toBeVisible();
    expect(screen.getByText('Completed experiments will appear here.')).toBeVisible();
    await press('Test a new question');
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(paid()).toEqual([]);
  });

  test('a failed list read is an error with retry, never an empty list', async () => {
    queue(`GET ${COMPLETED}`, { status: 503, body: { detail: 'Database unavailable' } });
    await openHistory();
    expect(await screen.findByText(/We couldn't load your history\. Database unavailable/)).toBeVisible();
    expect(screen.queryByText('Nothing finished yet.')).toBeNull();
    await press('Try again');
    expect((await screen.findAllByTestId('history-row')).length).toBe(2);
  });

  test('one row that fails keeps the others and retries by itself', async () => {
    queue(`GET /api/experiments/${older.id}/report`, { status: 503, body: { detail: 'Database unavailable' } });
    await openHistory();
    expect(await screen.findByText("Couldn't load this report.")).toBeVisible();
    expect(await screen.findByText('+21%')).toBeVisible();
    await press(`Try again for ${older.question}`);
    await waitFor(() => expect(screen.queryByText("Couldn't load this report.")).toBeNull());
    expect(count(`GET /api/experiments/${older.id}/report`)).toBe(2);
  });

  test('a completed experiment with no report says so', async () => {
    queue(`GET /api/experiments/${older.id}/report`, { status: 404, body: { detail: 'No report for this experiment yet' } });
    await openHistory();
    expect(await screen.findByText('Report not available yet.')).toBeVisible();
  });

  test('an outcome that could not be calculated is not shown as a number', async () => {
    const metrics = labReport.analysis.metrics.map(metric => ({ ...metric, percent_change: null }));
    defaults[`GET /api/experiments/${older.id}/report`] = { body: { ...reportFor(older), analysis: { ...labReport.analysis, metrics } } };
    await openHistory();
    expect(await screen.findByText('Not enough data')).toBeVisible();
  });

  test('a sample row is labelled', async () => {
    defaults[`GET ${COMPLETED}`] = { body: [{ ...newer, is_seeded: true }] };
    await openHistory();
    expect(await screen.findByText('Sample experiment')).toBeVisible();
  });

  test('an expired session returns to sign-in', async () => {
    queue(`GET ${COMPLETED}`, { status: 401, body: {} });
    await openHistory();
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeVisible();
  });

  test('offline before any load sends nothing and says so', async () => {
    render(<MobileApp />);
    await screen.findByRole('button', { name: /^Account menu/ });
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    await goTo('History');
    expect(await screen.findByText('Reconnect to load your history.')).toBeVisible();
    expect(count(`GET ${COMPLETED}`)).toBe(0);
  });

  test('going offline keeps the loaded list, labelled, and it can still open a loaded report', async () => {
    await openHistory();
    await waitFor(() => expect(screen.getAllByText('Likely signal')).toHaveLength(2));
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    expect(await screen.findByText(/^Offline, last updated /)).toBeVisible();
    expect(within(rows()[0]).getByText(newer.question)).toBeVisible();
    const reads = count(`GET /api/experiments/${newer.id}/report`);
    await press(`Open Lab Report for ${newer.question}`);
    expect(await screen.findByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
    expect(count(`GET /api/experiments/${newer.id}/report`)).toBe(reads);
  });
});

describe('completed demo', () => {
  async function openDemoScreen() {
    render(<MobileApp />);
    await goTo('Demo');
  }
  async function openDemo() {
    await openDemoScreen();
    await screen.findByRole('button', { name: 'Explore a completed example' });
    await press('Explore a completed example');
  }

  test('explains itself before anything is written', async () => {
    await openDemoScreen();
    expect(await screen.findByText('See a completed example')).toBeVisible();
    expect(screen.getByText("A sample experiment and its Lab Report, built from invented check-ins. It's never added to your own results and makes no AI calls. Opening it again resets the sample.")).toBeVisible();
    expect(count(RESET)).toBe(0);
  });

  test('opens a labelled report with the stored narrative and makes no paid call', async () => {
    await openDemo();
    expect(await screen.findByText('Sample experiment')).toBeVisible();
    expect(screen.getByText('This report is based on seeded example check-ins.')).toBeVisible();
    expect(screen.getByRole('header', { name: seededReport.experiment.question })).toBeVisible();
    expect(screen.getByText(writtenLabReport.narrative!.summary)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Write my report' })).toBeNull();
    expect(paid()).toEqual([]);
    expect(count(RESET)).toBe(1);
  });

  test('double taps reset once', async () => {
    await openDemoScreen();
    const button = await screen.findByRole('button', { name: 'Explore a completed example' });
    await act(async () => { fireEvent.press(button); fireEvent.press(button); });
    await screen.findByText('Sample experiment');
    expect(count(RESET)).toBe(1);
  });

  test('coexists with an active experiment: nothing removes it, and back returns to it', async () => {
    defaults[`GET ${ACTIVE}`] = { body: [running] };
    await openDemo();
    await screen.findByText('Sample experiment');
    await press('Back to demo');
    await goTo('Your lab');
    expect(await screen.findByText('Day 2 of 10')).toBeVisible();
    expect(calls.filter(call => call.includes('/remove') || call === 'POST /api/demo/active')).toEqual([]);
  });

  test('a failed reset explains and retries on a tap', async () => {
    queue(RESET, { status: 409, body: { detail: 'The demo is already being reset, try again' } });
    await openDemo();
    expect(await screen.findByText("Couldn't prepare the demo: The demo is already being reset, try again")).toBeVisible();
    expect(count(RESET)).toBe(1);
    await press('Try again');
    await screen.findByText('Sample experiment');
    expect(count(RESET)).toBe(2);
  });

  test('an expired session returns to sign-in', async () => {
    queue(RESET, { status: 401, body: {} });
    await openDemo();
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeVisible();
  });

  test('offline disables the reset', async () => {
    await openDemoScreen();
    await screen.findByRole('button', { name: 'Explore a completed example' });
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Explore a completed example' })).toBeDisabled());
  });
});

describe('calibration card', () => {
  const point = (number: number, guess: number, observed: number, off: number) => ({
    experiment_id: `exp-${number}`, question: `Question ${number}?`, completed_at: `2026-10-0${number}T10:00:00Z`,
    guessed_change_percent: guess, observed_change_percent: observed, off_by_points: off,
  });

  test('shows each guess against what happened, newest first, and the trend', async () => {
    defaults[`GET ${CALIBRATION}`] = { body: { points: [point(1, 10, 30, 20), point(2, 10, 12.5, 2.5)], average_off_by_points: 11.3, trend: 'closer' } };
    await openHistory();
    expect(await screen.findByText('Your guesses are getting closer.')).toBeVisible();
    expect(screen.getByText('Off by 11.3 points on average across 2 experiments. A few short experiments show a pattern, not proof.')).toBeVisible();
    const items = screen.getAllByTestId('calibration-point');
    expect(within(items[0]).getByText('Question 2?')).toBeVisible();
    expect(within(items[0]).getByText('You guessed +10% · It changed +12.5% · Off by 2.5 points')).toBeVisible();
    expect(within(items[1]).getByText('Question 1?')).toBeVisible();
  });

  test('explains what one guess cannot show yet', async () => {
    defaults[`GET ${CALIBRATION}`] = { body: { points: [point(1, 10, 11, 1)], average_off_by_points: 1, trend: null } };
    await openHistory();
    expect(await screen.findByText("Finish another experiment to see whether you're getting closer.")).toBeVisible();
    expect(screen.getByText('You guessed +10% · It changed +11% · Off by 1 point')).toBeVisible();
  });

  test('has an empty state that says how to start', async () => {
    await openHistory();
    expect(await screen.findByText(/Your next experiment asks for your own guess/)).toBeVisible();
  });

  test('a failure explains itself, retries on a tap and leaves the history in place', async () => {
    queue(`GET ${CALIBRATION}`, { status: 503, body: { detail: 'Database unavailable' } });
    await openHistory();
    expect(await screen.findByText(/Couldn't compare your guesses\. Database unavailable/)).toBeVisible();
    expect(rows()).toHaveLength(2);
    await press('Try again for your guesses');
    expect(await screen.findByText(/Your next experiment asks for your own guess/)).toBeVisible();
    expect(count(`GET ${CALIBRATION}`)).toBe(2);
  });
});
