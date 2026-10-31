import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import type { Checkin, Experiment, ExperimentTimeline } from '@rhythm-health/contract';
const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const active: Experiment = { ...experiment, status: 'active', metrics: [...experiment.metrics,
  { key: 'walked', label: 'Walked', type: 'boolean', min: null, max: null, primary: false },
  { key: 'minutes', label: 'Minutes outside', type: 'duration', min: null, max: null, primary: false }],
  progress: { ...experiment.progress, state: 'in_progress', day_number: 1 } };
let timeline: ExperimentTimeline;
let answers: Checkin[];
let readStatus: number;
const requests: string[] = [];
beforeEach(() => {
  jest.clearAllMocks(); mockNetwork.isConnected = mockNetwork.isInternetReachable = true; requests.length = 0; readStatus = 200;
  timeline = timelineFixture({ ...active, progress: { ...active.progress, day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7 } }, { recorded: [1, 3], missed: [2] });
  answers = [1, 3].map(day => ({ id: `44444444-4444-4444-8444-44444444444${day}`, experiment_id: active.id, day_number: day, phase: 'baseline', intervention_completed: false,
    metric_values: { morning_energy: day === 1 ? 6 : 8, walked: false, minutes: 0 }, note: day === 1 ? 'A quiet day.' : null,
    created_at: '2026-10-31T10:00:00Z', updated_at: '2026-10-31T10:00:00Z' }));
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake-token', user: { id: 'fake-user' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }); mockAuth.signOut.mockResolvedValue({ error: null });
  global.fetch = jest.fn(async (url, options) => {
    expect(options?.method).toBe('GET'); const path = new URL(String(url)).pathname; requests.push(path);
    if (path.endsWith('/checkins') && readStatus !== 200) return { ok: false, status: readStatus, json: async () => ({ detail: 'Answers unavailable' }) } as Response;
    return { ok: true, status: 200, json: async () => path === '/api/profile' ? profile : path.endsWith('/progress') ? timeline : path.endsWith('/checkins') ? answers : [active] } as Response;
  });
});
async function open() { const view = render(<MobileApp />); fireEvent.press(await screen.findByRole('button', { name: 'Progress' })); await screen.findByText('Your progress.'); return view; }

test('shows endpoint counts and labelled day states despite the cached experiment summary', async () => {
  await open(); expect(screen.getByText('2 of 10 recorded')).toBeVisible(); expect(screen.getByText('1 missed')).toBeVisible(); expect(screen.getByText('7 remaining')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Day 1, Baseline, Recorded' })).toBeVisible();
  expect(screen.getByText('Day 2 · Baseline · Missed')).toBeVisible(); expect(screen.getByText('Day 4 · Test · Today')).toBeVisible();
  expect(screen.getByText('Day 5 · Test · Coming up')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Day 5/ })).toBeNull();
  expect(screen.getByText("Missed days can't be filled in.")).toBeVisible();
});

test('selecting a recorded day shows read-only answers, including false, zero and the note', async () => {
  await open(); await screen.findByText('Day 3 answers'); fireEvent.press(screen.getByRole('button', { name: 'Day 1, Baseline, Recorded' }));
  expect(await screen.findByText('Day 1 answers')).toBeVisible(); expect(screen.getByText('Morning energy: 6 of 10')).toBeVisible();
  expect(screen.getByText('Walked: No')).toBeVisible(); expect(screen.getByText('Minutes outside: 0 minutes')).toBeVisible(); expect(screen.getByText('A quiet day.')).toBeVisible();
  expect(screen.queryByLabelText('Optional note')).toBeNull(); expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
});

test('answers have loading and error/retry states without hiding the authoritative timeline', async () => {
  const fetch = global.fetch; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  global.fetch = jest.fn(async (...args) => { if (String(args[0]).endsWith('/checkins')) await gate; return fetch(...args); });
  readStatus = 503; await open(); expect(await screen.findByText('Loading recorded answers…')).toBeVisible();
  expect(screen.getByText('2 of 10 recorded')).toBeVisible(); await act(async () => { release(); });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Answers unavailable/); expect(screen.queryByText('Day 3 answers')).toBeNull();
  readStatus = 200; fireEvent.press(screen.getByRole('button', { name: 'Retry answers' })); expect(await screen.findByText('Day 3 answers')).toBeVisible();
});

test('an expired answers session hides private progress and returns to sign-in', async () => {
  readStatus = 401; await open(); expect(await screen.findByLabelText('Email')).toBeVisible(); expect(screen.queryByText('2 of 10 recorded')).toBeNull();
});

test('offline keeps cached progress and answers labelled without another read', async () => {
  const view = await open(); await screen.findByText('Day 3 answers'); const before = requests.length;
  mockNetwork.isConnected = false; view.rerender(<MobileApp />);
  expect(await screen.findByText('Offline. Showing the last loaded progress.')).toBeVisible(); expect(screen.getByText('Morning energy: 8 of 10')).toBeVisible(); expect(requests).toHaveLength(before);
});

test('no recorded days is a useful empty state, without an unnecessary answers read', async () => {
  timeline = timelineFixture({ ...active, progress: timeline.progress }); await open();
  expect(screen.getByText('0 of 10 recorded')).toBeVisible(); expect(screen.getByText('No days recorded yet. Your next check-in will start the record.')).toBeVisible();
  expect(requests.some(path => path.endsWith('/checkins'))).toBe(false);
});

test('an absent recorded answer is not invented', async () => {
  answers = []; await open(); expect(await screen.findByText('No answers returned for this day.')).toBeVisible();
  expect(screen.queryByText(/Morning energy:/)).toBeNull();
});

test('early-finished future days stay Not observed, never Missed', async () => {
  timeline = timelineFixture({ ...active, progress: { ...timeline.progress, state: 'completed', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } }, { recorded: [1, 3], missed: [2] });
  await open(); expect(screen.getByText('Day 5 · Test · Not observed')).toBeVisible(); expect(screen.getByText('0 remaining')).toBeVisible();
  expect(screen.queryByText('Day 5 · Test · Missed')).toBeNull(); await screen.findByText('Day 3 answers');
});

test.each([true, false])('recorded answers are available immediately with reduced motion %s', async reduced => {
  const { AccessibilityInfo } = jest.requireActual('react-native') as typeof import('react-native');
  const spy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced);
  try { await open(); await screen.findByText('Day 3 answers'); fireEvent.press(screen.getByRole('button', { name: 'Day 1, Baseline, Recorded' }));
    await waitFor(() => expect(screen.getByText('Day 1 answers')).toBeVisible());
  } finally { spy.mockRestore(); }
});

test('recorded test-day answers include the intervention question without an edit action', async () => {
  timeline = timelineFixture({ ...active, progress: timeline.progress }, { recorded: [1, 3, 4], missed: [2] });
  answers.push({ ...answers[0], id: '44444444-4444-4444-8444-444444444444', day_number: 4, phase: 'intervention', intervention_completed: false });
  await open(); expect(await screen.findByText('Made the change: Not today')).toBeVisible();
  expect(screen.queryByRole('button', { name: "Change today's answers" })).toBeNull();
});

test('opening Progress offline never pretends to have loaded recorded answers', async () => {
  const view = render(<MobileApp />); await screen.findByText(active.question);
  mockNetwork.isConnected = false; view.rerender(<MobileApp />); fireEvent.press(screen.getByRole('button', { name: 'Progress' }));
  expect(await screen.findByText('No connection. Reconnect to load recorded answers.')).toBeVisible();
  expect(requests.some(path => path.endsWith('/checkins'))).toBe(false);
});
