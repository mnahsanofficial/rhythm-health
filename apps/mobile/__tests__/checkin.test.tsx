import { notifications, notificationState, preferences, responses, tapReminder } from './support/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import type { Checkin, CheckinInput, Experiment } from '@rhythm-health/contract';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

let active: Experiment;
let logged: Checkin[];
let posts: CheckinInput[];
let failSave: number;
let failRead: boolean;
let failRefresh: boolean;
let serverDay: number;
const makeCheckin = (values: CheckinInput): Checkin => ({
  id: '44444444-4444-4444-8444-444444444444', experiment_id: experiment.id, day_number: serverDay,
  phase: serverDay === 1 ? 'baseline' : 'intervention', intervention_completed: values.intervention_completed ?? false,
  metric_values: values.metric_values, note: values.note ?? null,
  created_at: '2026-10-31T09:00:00Z', updated_at: '2026-10-31T09:00:00Z',
});
function progress() {
  return timelineFixture({ ...active, progress: { ...active.progress, day_number: serverDay } }, {
    recorded: logged.map(checkin => checkin.day_number), nextDayAt: '2026-11-02T18:45:00Z',
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  active = { ...experiment, status: 'active', metrics: [
    { key: 'morning_energy', label: 'Morning energy', type: 'scale', min: 1, max: 10, min_label: null, max_label: null, primary: true },
    { key: 'breaks', label: 'Breaks', type: 'number', min: null, max: null, min_label: null, max_label: null, primary: false },
    { key: 'minutes_to_sleep', label: 'Minutes to fall asleep', type: 'duration', min: null, max: null, min_label: null, max_label: null, primary: false },
    { key: 'screen_free', label: 'Screen-free evening', type: 'boolean', min: null, max: null, min_label: null, max_label: null, primary: false },
  ], progress: { ...experiment.progress, state: 'in_progress', day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7, days_remaining: 6 } };
  serverDay = 4; logged = []; posts = []; failSave = 0; failRead = false; failRefresh = false;
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  global.fetch = jest.fn(async (url, options) => {
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer fake-token' });
    const path = new URL(String(url)).pathname;
    let body: unknown;
    if (path === '/api/profile') body = profile;
    else if (path === '/api/experiments') body = [active];
    else if (path.endsWith('/progress')) {
      if (failRefresh && posts.length) return { ok: false, status: 503, json: async () => ({ detail: 'Progress unavailable' }) } as Response;
      body = progress();
    } else if (path.endsWith('/checkins') && options?.method === 'POST') {
      const input: CheckinInput = JSON.parse(options.body as string); posts.push(input);
      if (failSave) { const status = failSave; failSave = 0; return { ok: false, status, json: async () => ({ detail: status === 422 ? [{ field: 'breaks', message: 'Check this answer' }] : 'Save unavailable' }) } as Response; }
      const saved = makeCheckin(input); logged = [saved]; body = saved;
    } else if (path.endsWith('/checkins')) {
      if (failRead) { failRead = false; return { ok: false, status: 503, json: async () => ({ detail: 'Check-ins unavailable' }) } as Response; }
      body = logged;
    } else throw new Error('Unexpected fake endpoint');
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

async function open() {
  const view = render(<MobileApp />);
  fireEvent.press(await screen.findByRole('button', { name: /Check in for day|Change today's answers/ }));
  await screen.findByText("Today's check-in.");
  await screen.findByLabelText('Breaks');
  return view;
}
async function answer() {
  fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
  fireEvent.changeText(screen.getByLabelText('Breaks'), '-2.5');
  fireEvent.changeText(screen.getByLabelText('Minutes to fall asleep, in minutes'), '20,5');
  fireEvent.press(screen.getByRole('radio', { name: 'Screen-free evening: No' }));
  fireEvent.changeText(screen.getByLabelText('Optional note'), '  A quiet evening.  ');
}

test('all four metric types save the typed contract and return to recorded Today automatically', async () => {
  await open(); await answer();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" })); });
  expect(await screen.findByText('Done for today')).toBeVisible();
  expect(posts).toEqual([{ intervention_completed: true, metric_values: { morning_energy: 7, breaks: -2.5, minutes_to_sleep: 20.5, screen_free: false }, note: 'A quiet evening.' }]);
});

test('scale endpoints use words, including the neutral fallback for an unknown key', async () => {
  active.metrics[0] = { ...active.metrics[0], key: 'daily_rating', label: 'Daily rating' };
  active.success_criteria = { ...active.success_criteria, primary_metric: 'daily_rating' };
  active.prediction = { ...active.prediction, target_metric: 'daily_rating' };
  await open();
  expect(screen.getByText('1 Low · 10 High')).toBeVisible();
});

test('server-labelled energy scales name both ends', async () => {
  active.metrics[0] = { ...active.metrics[0], min_label: 'Drained', max_label: 'Full of energy' };
  await open(); expect(screen.getByText('1 Drained · 10 Full of energy')).toBeVisible();
});

test('baseline omits the test-day question and sends no intervention answer', async () => {
  serverDay = 1; active.progress = { ...active.progress, day_number: 1, phase: 'baseline', phase_day: 1, phase_days: 3 };
  await open();
  expect(screen.queryByText('Did you make the change today?')).toBeNull();
  fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
  fireEvent.changeText(screen.getByLabelText('Breaks'), '0'); fireEvent.changeText(screen.getByLabelText('Minutes to fall asleep, in minutes'), '0');
  fireEvent.press(screen.getByRole('radio', { name: 'Screen-free evening: No' }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" })); });
  await screen.findByText('Done for today');
  expect(posts[0]).not.toHaveProperty('intervention_completed');
  expect(posts[0].metric_values.breaks).toBe(0);
});

test('existing answers prefill from check-ins, including false and zero', async () => {
  logged = [makeCheckin({ intervention_completed: false, metric_values: { morning_energy: 5, breaks: 0, minutes_to_sleep: 10, screen_free: false }, note: 'Earlier note' })];
  await open();
  expect(screen.getByLabelText('Breaks')).toHaveDisplayValue('0');
  expect(screen.getByRole('radio', { name: 'Not today' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Screen-free evening: No' })).toBeChecked();
  expect(screen.getByLabelText('Optional note')).toHaveDisplayValue('Earlier note');
});

test('failed saves keep every answer and retry only when the person asks', async () => {
  failSave = 503; await open(); await answer();
  fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Save unavailable/);
  expect(screen.getByLabelText('Breaks')).toHaveDisplayValue('-2.5');
  expect(screen.getByLabelText('Optional note')).toHaveDisplayValue('  A quiet evening.  ');
  expect(posts).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Try saving again' }));
  expect(await screen.findByText('Done for today')).toBeVisible();
  expect(posts).toHaveLength(2);
});

test('422 messages are placed beside the named field and preserve the answer', async () => {
  failSave = 422; await open(); await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByText('Check this answer')).toBeVisible();
  expect(screen.getByLabelText('Breaks')).toHaveDisplayValue('-2.5');
});

test('missing and invalid answers cannot be submitted', async () => {
  await open();
  fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByText(/answer.*missing/i)).toBeVisible();
  expect(posts).toHaveLength(0);
  await answer(); fireEvent.changeText(screen.getByLabelText('Breaks'), 'not a number');
  fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(posts).toHaveLength(0);
});

test('offline keeps answers and disables Save until reconnected', async () => {
  const view = await open(); await answer(); mockNetwork.isConnected = false; view.rerender(<MobileApp />);
  expect(await screen.findByText("You're offline; your answers are kept")).toBeVisible();
  expect(screen.getByLabelText('Breaks')).toHaveDisplayValue('-2.5');
  expect(screen.getByRole('button', { name: "Save today's check-in" })).toBeDisabled();
  expect(posts).toHaveLength(0);
});

test('check-in read failures have retry and do not display an empty editable form', async () => {
  failRead = true; render(<MobileApp />);
  fireEvent.press(await screen.findByRole('button', { name: 'Check in for day 4' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Check-ins unavailable/);
  expect(screen.queryByLabelText('Breaks')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByLabelText('Breaks')).toBeVisible();
});

test('a saved check-in whose progress reload fails is not submitted again', async () => {
  failRefresh = true; await open(); await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByText(/check-in was saved/i)).toBeVisible();
  expect(posts).toHaveLength(1); failRefresh = false;
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Done for today')).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('a changed server day blocks a stale form before a POST', async () => {
  await open(); await answer(); serverDay = 5;
  fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByText(/Today has changed/)).toBeVisible();
  expect(posts).toHaveLength(0);
});

test('a second Save tap is ignored while the first request is pending', async () => {
  const fetch = global.fetch; let release!: () => void; let sending = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  global.fetch = jest.fn(async (...args) => { if (args[1]?.method === 'POST') { sending++; await gate; } return fetch(...args); });
  await open(); await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  const busy = await screen.findByRole('button', { name: 'Saving…' });
  expect(busy).toBeDisabled(); fireEvent.press(busy); expect(sending).toBe(1);
  await act(async () => { release(); });
  expect(await screen.findByText('Done for today')).toBeVisible(); expect(posts).toHaveLength(1);
});

test('a save with an expired session hides the form and signs out', async () => {
  failSave = 401; await open(); await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByLabelText('Breaks')).toBeNull(); expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test.each([true, false])('save confirmation stays immediate with reduced motion %s', async reduced => {
  const { AccessibilityInfo, Animated } = jest.requireActual('react-native') as typeof import('react-native');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced);
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await open(); await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByText('Done for today')).toBeVisible();
  expect(screen.getByText('Check-in saved.')).toBeVisible();
  if (reduced) expect(timing).not.toHaveBeenCalled();
  else expect(timing).toHaveBeenCalled();
});


test('the first saved check-in offers reminders without prompting the OS automatically', async () => {
  await open(); expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Enable daily reminders' })).toBeNull();
  await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  expect(await screen.findByRole('button', { name: 'Enable daily reminders' })).toBeVisible();
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('a saved check-in reschedules the opted-in reminder from refreshed progress', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T12:00:00Z'));
  preferences.set('rhythm.reminders.fake-user', 'on'); notificationState.granted = true;
  await open(); await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled());
  const before = notifications.scheduleNotificationAsync.mock.calls.length;
  await answer(); fireEvent.press(screen.getByRole('button', { name: "Save today's check-in" }));
  await screen.findByText('Done for today');
  await waitFor(() => expect(notifications.scheduleNotificationAsync.mock.calls.length).toBeGreaterThan(before));
  expect(notifications.scheduleNotificationAsync.mock.calls.at(-1)?.[0].trigger).toMatchObject({ date: new Date('2026-11-02T18:45:00Z') });
});


test("a next-day notification opens a fresh form without copying yesterday's unsaved answers", async () => {
  await open(); await answer(); serverDay = 5; active.progress = { ...active.progress, phase_day: 2 };
  await act(async () => { responses.forEach(listener => listener(tapReminder('fake-user', active.id))); });
  expect(await screen.findByText('Day 5 · Test')).toBeVisible();
  await waitFor(() => expect(screen.getByLabelText('Breaks')).toHaveDisplayValue(''));
  expect(screen.getByLabelText('Optional note')).toHaveDisplayValue(''); expect(posts).toHaveLength(0);
});
