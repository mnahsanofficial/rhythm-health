import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { notifications, notificationState, preferences, responses, tapReminder } from './support/notifications';
import type { ExperimentTimeline } from '@rhythm-health/contract';
const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const active = { ...experiment, status: 'active' as const, progress: { ...experiment.progress, state: 'in_progress' as const, day_number: 4, phase: 'intervention' as const, phase_day: 1, phase_days: 7 } };
let timeline: ExperimentTimeline;
let listeners: Set<(state: AppStateStatus) => void>;
let hasExperiment: boolean;
beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T12:00:00Z'));
  timeline = timelineFixture(active, { recorded: [1], nextDayAt: '2027-11-01T06:30:00Z' }); hasExperiment = true;
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  listeners = new Set(); jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; });
  global.fetch = jest.fn(async url => ({ ok: true, status: 200, json: async () => String(url).endsWith('/api/profile') ? profile : String(url).endsWith('/progress') ? timeline : String(url).endsWith('/checkins') ? [] : hasExperiment ? [active] : [] }) as Response);
});
afterEach(() => jest.restoreAllMocks());
async function settings() { fireEvent.press(await screen.findByRole('button', { name: 'Settings' })); await screen.findByRole('switch', { name: 'Daily reminders' }); }
async function enable() { notificationState.granted = true; await settings(); fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', true); await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled()); }

test('does not ask OS permission on launch, explains reminders after a recorded check-in', async () => {
  render(<MobileApp />); await screen.findByText(active.question);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(await screen.findByText(/A reminder when the next day opens/)).toBeVisible();
  notificationState.granted = true; fireEvent.press(screen.getByRole('button', { name: 'Enable daily reminders' }));
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled());
});

test('schedules the exact API instant with a stable identifier and day-only content', async () => {
  render(<MobileApp />); await enable();
  const request = notifications.scheduleNotificationAsync.mock.calls[0][0];
  expect(request).toMatchObject({ identifier: 'rhythm.next-day', content: { title: 'Day 5 of 10 is open', body: 'Your check-in takes about 30 seconds.' }, trigger: { type: 'date', date: new Date(timeline.next_day_at!) } });
  expect(JSON.stringify(request.content)).not.toContain(active.question);
});

test('foreground refresh replaces the previous reminder, never a repeating calendar trigger', async () => {
  render(<MobileApp />); await enable(); const before = notifications.scheduleNotificationAsync.mock.calls.length;
  timeline = { ...timeline, next_day_at: '2027-11-01T07:30:00Z' };
  await act(async () => { listeners.forEach(listener => listener('active')); });
  await waitFor(() => expect(notifications.scheduleNotificationAsync.mock.calls.length).toBeGreaterThan(before));
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.next-day');
  expect(notifications.scheduleNotificationAsync.mock.calls.at(-1)?.[0].trigger).toMatchObject({ date: new Date(timeline.next_day_at!) });
});

test('denied permission gives Settings guidance without blocking Today', async () => {
  notificationState.denied = true; jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  render(<MobileApp />); await settings(); fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', true);
  expect(await screen.findByText(/Reminders are off/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Open phone Settings' })); expect(Linking.openSettings).toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Today' })); expect(await screen.findByText(active.question)).toBeVisible();
});

test('turning off cancels daily and test reminders and persists that choice', async () => {
  render(<MobileApp />); await enable(); notifications.cancelScheduledNotificationAsync.mockClear();
  fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', false);
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Daily reminders' })).not.toBeChecked());
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.next-day');
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.test');
  expect([...preferences.values()]).toContain('off');
});

test.each(['last', 'finished', 'empty'])('cancels when progress becomes %s', async state => {
  render(<MobileApp />); await enable(); notifications.cancelScheduledNotificationAsync.mockClear(); notifications.scheduleNotificationAsync.mockClear();
  if (state === 'empty') hasExperiment = false;
  else timeline = { ...timeline, next_day_at: null, progress: { ...timeline.progress, ...(state === 'finished' ? { state: 'completed' as const } : {}) } };
  await act(async () => { listeners.forEach(listener => listener('active')); });
  await waitFor(() => expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.next-day'));
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('sign-out cancels owned notifications before removing the native session', async () => {
  render(<MobileApp />); await enable(); notifications.cancelScheduledNotificationAsync.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' })); await screen.findByLabelText('Email');
  await waitFor(() => expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.next-day'));
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('cold-start tap waits for sign-in then opens the current check-in', async () => {
  notificationState.last = tapReminder('fake-user', active.id); mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<MobileApp />); fireEvent.changeText(await screen.findByLabelText('Email'), 'learner@example.invalid'); fireEvent.changeText(screen.getByLabelText('Password'), 'fake-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' })); expect(await screen.findByText("Today's check-in.")).toBeVisible();
  expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
});

test('warm tap refreshes progress and opens check-in only for the signed-in owner', async () => {
  render(<MobileApp />); await screen.findByText(active.question);
  await act(async () => { responses.forEach(listener => listener(tapReminder('another-user', active.id))); });
  expect(screen.queryByText("Today's check-in.")).toBeNull();
  await act(async () => { responses.forEach(listener => listener({ ...tapReminder('fake-user', active.id), notification: { ...tapReminder('fake-user', active.id).notification, date: 2 } })); });
  expect(await screen.findByText("Today's check-in.")).toBeVisible();
});

test('scheduling failure is visible with retry and Today remains usable', async () => {
  notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native failure'));
  render(<MobileApp />); notificationState.granted = true; await settings(); fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', true);
  expect(await screen.findByText(/Couldn't update your reminder/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry reminder' })); await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2));
});

test('development test uses a one-off ten-second trigger and production hides it', async () => {
  const view = render(<MobileApp />); await enable();
  fireEvent.press(screen.getByRole('button', { name: 'Send a test reminder in 10 seconds' }));
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'rhythm.test', trigger: expect.objectContaining({ seconds: 10, repeats: false }) })));
  view.unmount(); const old = Reflect.get(globalThis, '__DEV__'); Reflect.set(globalThis, '__DEV__', false);
  try { render(<MobileApp />); await settings(); expect(screen.queryByRole('button', { name: 'Send a test reminder in 10 seconds' })).toBeNull(); } finally { Reflect.set(globalThis, '__DEV__', old); }
});

test('turning reminders off cancels immediately even if saving the preference fails', async () => {
  const store = jest.requireMock('expo-secure-store') as typeof import('expo-secure-store');
  render(<MobileApp />); await enable(); notifications.cancelScheduledNotificationAsync.mockClear();
  jest.mocked(store.setItemAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', false);
  await screen.findByText(/Couldn't update your reminder/);
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rhythm.next-day');
  expect(screen.getByRole('switch', { name: 'Daily reminders' })).not.toBeChecked();
});

test('a preference read error can be retried instead of leaving Settings disabled', async () => {
  const store = jest.requireMock('expo-secure-store') as typeof import('expo-secure-store');
  jest.mocked(store.getItemAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  render(<MobileApp />); await settings(); await screen.findByText(/Couldn't update your reminder/);
  fireEvent.press(screen.getByRole('button', { name: 'Retry reminder' }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Daily reminders' })).toBeEnabled());
});

test.each(['Asia/Dhaka', 'America/Toronto'])('the DST opening stays the same UTC instant in %s', async zone => {
  const original = process.env.TZ; process.env.TZ = zone;
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T12:00:00Z'));
  timeline = { ...timeline, next_day_at: '2026-11-01T06:30:00Z' };
  try {
    render(<MobileApp />); await enable();
    const trigger = notifications.scheduleNotificationAsync.mock.calls.at(-1)?.[0].trigger;
    expect(trigger).toMatchObject({ type: 'date', date: new Date('2026-11-01T06:30:00Z') });
  } finally { process.env.TZ = original; }
});


test('the OS prompt happens only after an explicit opt-in', async () => {
  notifications.requestPermissionsAsync.mockImplementationOnce(async () => { notificationState.granted = true; return { granted: true, canAskAgain: true }; });
  render(<MobileApp />); await settings(); expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', true);
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled());
  expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('a scheduling request that finishes after sign-out is cancelled', async () => {
  notificationState.granted = true; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  notifications.scheduleNotificationAsync.mockImplementationOnce(async () => { await gate; return 'rhythm.next-day'; });
  render(<MobileApp />); await settings(); fireEvent(screen.getByRole('switch', { name: 'Daily reminders' }), 'valueChange', true);
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled());
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' })); await screen.findByLabelText('Email');
  await act(async () => { release(); });
  await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalled());
  expect(Math.max(...notifications.cancelScheduledNotificationAsync.mock.invocationCallOrder)).toBeGreaterThan(Math.max(...notifications.scheduleNotificationAsync.mock.invocationCallOrder));
});

test('a cancellation failure stays visible after signing out and can be retried', async () => {
  render(<MobileApp />); await enable();
  notifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('native cancel failed'));
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' })); await screen.findByLabelText('Email');
  expect(await screen.findByText(/Couldn't update your reminder/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry reminder' }));
  await waitFor(() => expect(screen.queryByText(/Couldn't update your reminder/)).toBeNull());
});
