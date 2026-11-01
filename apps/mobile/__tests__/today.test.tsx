import normal from '../../../frontend/tests/support/baseline-summary.json';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import type { Experiment } from '@rhythm-health/contract';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const active: Experiment = { ...experiment, status: 'active', progress: {
  ...experiment.progress, state: 'in_progress', day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7,
  days_remaining: 6, started_at: '2026-10-01T09:00:00Z',
} };
const nextDayAt = '2026-11-02T18:45:00Z';
let timeline = timelineFixture(active, { missed: [1, 2, 3], nextDayAt });
let list: Experiment[];
let listeners: Set<(state: AppStateStatus) => void>;
const requests: string[] = [];

beforeEach(() => {
  jest.clearAllMocks(); requests.length = 0;
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  list = [active]; timeline = timelineFixture(active, { missed: [1, 2, 3], nextDayAt });
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  listeners = new Set();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listeners.add(callback); return { remove: () => listeners.delete(callback) };
  });
  global.fetch = jest.fn(async (url, options) => {
    expect(options?.headers).toEqual({ Authorization: 'Bearer fake-token' });
    expect(options?.method).toBe('GET');
    const path = String(url).replace('http://api.test.invalid:8001', ''); requests.push(path);
    const body = path === '/api/profile' ? profile : path === '/api/experiments?status=active' ? list
      : path === `/api/experiments/${active.id}/progress` ? timeline : undefined;
    if (body === undefined) throw new Error('Unexpected fake request');
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

test('loads the real question, intervention, day and phase from authoritative progress', async () => {
  render(<MobileApp />);
  expect(await screen.findByText(active.question)).toBeVisible();
  expect(screen.getByText(active.intervention.action)).toBeVisible();
  expect(screen.getByText('Day 4 of 10')).toBeVisible();
  expect(screen.getByText('Test day 1 of 7')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Check in for day 4' })).toBeEnabled();
  expect(requests).toEqual(['/api/profile', '/api/experiments?status=active', `/api/experiments/${active.id}/progress`]);
});

test('a recorded current day shows Done for today and uses the returned next opening', async () => {
  timeline = timelineFixture(active, { recorded: [4], missed: [1, 2, 3], nextDayAt });
  render(<MobileApp />);
  expect(await screen.findByText('Done for today')).toBeVisible();
  const time = new Date(nextDayAt).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  expect(screen.getByText(`Day 5 opens ${time}.`)).toBeVisible();
  expect(screen.getByRole('button', { name: "Change today's answers" })).toBeEnabled();
});

test('no active experiment links to the web without fetching progress', async () => {
  list = []; render(<MobileApp />);
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Start an experiment on the web' })).toBeVisible();
  expect(requests).toEqual(['/api/profile', '/api/experiments?status=active']);
});

test('keeps a content-shaped skeleton until progress resolves', async () => {
  const fetch = global.fetch; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  global.fetch = jest.fn(async (...args) => { if (String(args[0]).endsWith('/progress')) await gate; return fetch(...args); });
  render(<MobileApp />);
  expect(await screen.findByText('Loading your day…')).toBeVisible();
  expect(screen.queryByText(active.question)).toBeNull();
  await act(async () => { release(); });
  expect(await screen.findByText(active.question)).toBeVisible();
});

test('progress failures offer retry and never invent a current day', async () => {
  const fetch = global.fetch; let failed = false;
  global.fetch = jest.fn(async (...args) => {
    if (String(args[0]).endsWith('/progress') && !failed) { failed = true; return { ok: false, status: 503 } as Response; }
    return fetch(...args);
  });
  render(<MobileApp />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't load your day/);
  expect(screen.queryByText('Day 4 of 10')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Day 4 of 10')).toBeVisible();
});

test('returning to the foreground reloads progress and picks up a web check-in', async () => {
  render(<MobileApp />); await screen.findByText(active.question);
  timeline = timelineFixture(active, { recorded: [4], nextDayAt });
  await act(async () => { listeners.forEach(callback => callback('background')); listeners.forEach(callback => callback('active')); });
  expect(await screen.findByText('Done for today')).toBeVisible();
  expect(requests.filter(path => path.endsWith('/progress'))).toHaveLength(2);
});

test('offline retains the last loaded day, labels its age and disables check-in', async () => {
  const view = render(<MobileApp />); await screen.findByText(active.question);
  const before = requests.length; mockNetwork.isConnected = false; view.rerender(<MobileApp />);
  expect(await screen.findByText(/^Offline, last updated /)).toBeVisible();
  expect(screen.getByText(active.question)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Check in for day 4' })).toBeDisabled();
  expect(requests.length).toBe(before);
});

test('an expired progress session hides the private day and returns to sign-in', async () => {
  const fetch = global.fetch;
  global.fetch = jest.fn(async (...args) => String(args[0]).endsWith('/progress') ? { ok: false, status: 401 } as Response : fetch(...args));
  render(<MobileApp />);
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByText(active.question)).toBeNull();
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test.each(['not_started', 'ended', 'completed'] as const)('handles %s without offering a check-in', async state => {
  timeline = timelineFixture({ ...active, progress: { ...active.progress, state, day_number: null } });
  render(<MobileApp />);
  expect(await screen.findByText(active.question)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Check in for day/ })).toBeNull();
  expect(screen.getByRole('link', { name: state === 'completed' ? 'See your Lab Report on the web' : state === 'ended' ? 'Finish on the web' : 'Open your experiment on the web' })).toBeVisible();
});


test('Today renders each server baseline description before asking for a test-day check-in', async () => {
  timeline = { ...timeline, baseline_summary: normal }; render(<MobileApp />);
  expect(await screen.findByText('Your normal, before the change.')).toBeVisible();
  expect(screen.getByText('2 of 3 normal days recorded.')).toBeVisible();
  normal.metrics.forEach(metric => expect(screen.getByText(metric.description)).toBeVisible());
  expect(screen.getByRole('button', { name: 'Check in for day 4' })).toBeEnabled();
});
test('a missing baseline stays honest and does not block Check-in', async () => {
  timeline = { ...timeline, baseline_summary: { ...normal, days_recorded: 0, metrics: [] } }; render(<MobileApp />);
  expect(await screen.findByText('No normal-day answers recorded.')).toBeVisible();
  expect(screen.queryByText(normal.metrics[0].description)).toBeNull();
  expect(screen.getByRole('button', { name: 'Check in for day 4' })).toBeEnabled();
});
test('before the boundary and older progress responses show no invented normal', async () => {
  Reflect.deleteProperty(timeline, 'baseline_summary'); render(<MobileApp />); await screen.findByText(active.question);
  expect(screen.queryByText('Your normal, before the change.')).toBeNull();
});
test('offline retains the labelled last-loaded baseline and disables Check-in', async () => {
  timeline = { ...timeline, baseline_summary: normal }; const view = render(<MobileApp />);
  await screen.findByText(normal.metrics[0].description); mockNetwork.isConnected = false; view.rerender(<MobileApp />);
  expect(screen.getByText(/Offline, last updated/)).toBeVisible(); expect(screen.getByText(normal.metrics[0].description)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Check in for day 4' })).toBeDisabled();
});

test('an empty account offers an explicitly labelled active sample', async () => {
  list = []; render(<MobileApp />);
  expect(await screen.findByRole('button', { name: 'Try a sample experiment' })).toBeVisible();
  expect(screen.getByText(/Sample answers never become your real experiment data/)).toBeVisible();
});

test('sample Today is labelled and removal asks before making any request', async () => {
  list = [{ ...active, is_seeded: true }]; render(<MobileApp />);
  expect(await screen.findByText('Sample experiment')).toBeVisible();
  expect(screen.getByText(/Reminders are off for this sample/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Remove sample' }));
  expect(screen.getByText('Remove this sample experiment?')).toBeVisible();
  expect(requests.every(path => !path.includes('/remove'))).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Keep sample' }));
  expect(screen.queryByText('Remove this sample experiment?')).toBeNull();
});

test('starting a sample refreshes Today; confirmed removal returns to the empty state', async () => {
  list = [];
  const fetch = global.fetch;
  const mutations: string[] = [];
  global.fetch = jest.fn(async (url, options) => {
    const path = String(url);
    if (options?.method === 'POST') {
      mutations.push(path);
      expect(options.headers).toEqual({ Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' });
      if (path.endsWith('/api/demo/active')) {
        expect(JSON.parse(String(options.body))).toEqual({});
        list = [{ ...active, is_seeded: true }];
        return { ok: true, status: 201, json: async () => list[0] } as Response;
      }
      expect(JSON.parse(String(options.body))).toEqual({ confirmed: true });
      list = [];
      return { ok: true, status: 200, json: async () => ({ removed: true }) } as Response;
    }
    return fetch(url, options);
  });
  render(<MobileApp />);
  fireEvent.press(await screen.findByRole('button', { name: 'Try a sample experiment' }));
  expect(await screen.findByText('Sample experiment')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Remove sample' }));
  expect(mutations).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Confirm remove sample' }));
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
  expect(mutations).toHaveLength(2);
});

test('an active real experiment explains why a sample cannot be started', async () => {
  render(<MobileApp />);
  expect(await screen.findByText(/A sample needs the active experiment slot/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Try a sample experiment' })).toBeNull();
});

test('a failed sample start preserves the empty state and offers retry', async () => {
  list = []; const fetch = global.fetch;
  global.fetch = jest.fn(async (url, options) => options?.method === 'POST'
    ? { ok: false, status: 503, json: async () => ({ detail: 'Sample service unavailable. Try again.' }) } as Response : fetch(url, options));
  render(<MobileApp />);
  fireEvent.press(await screen.findByRole('button', { name: 'Try a sample experiment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sample service unavailable. Try again.');
  expect(screen.getByRole('button', { name: 'Try a sample experiment' })).toBeEnabled();
});

test('removal failure keeps the sample and its confirmation available for retry', async () => {
  list = [{ ...active, is_seeded: true }]; const fetch = global.fetch;
  global.fetch = jest.fn(async (url, options) => options?.method === 'POST'
    ? { ok: false, status: 503, json: async () => ({ detail: 'Could not remove sample. Try again.' }) } as Response : fetch(url, options));
  render(<MobileApp />);
  fireEvent.press(await screen.findByRole('button', { name: 'Remove sample' }));
  fireEvent.press(screen.getByRole('button', { name: 'Confirm remove sample' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove sample. Try again.');
  expect(screen.getByRole('button', { name: 'Confirm remove sample' })).toBeEnabled();
  expect(screen.getByText(active.question)).toBeVisible();
});

test('offline sample controls are disabled while cached sample labels remain visible', async () => {
  list = [{ ...active, is_seeded: true }]; const view = render(<MobileApp />);
  await screen.findByText('Sample experiment');
  mockNetwork.isConnected = false; view.rerender(<MobileApp />);
  expect(screen.getByText('Sample experiment')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Remove sample' })).toBeDisabled();
});
