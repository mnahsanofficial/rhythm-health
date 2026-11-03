import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Experiment } from '@rhythm-health/contract';
import { Reminders } from '../src/lib/reminders';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { notifications, notificationState, pending, responses, tapReminder } from './support/notifications';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const running = (id: string, day: number, extra: Partial<Experiment> = {}): Experiment => ({
  ...experiment, id, question: `Question ${id}?`, status: 'active',
  progress: { ...experiment.progress, state: 'in_progress', day_number: day, phase: 'baseline', phase_day: day, phase_days: 3, total_days: 10, days_remaining: 10 - day, started_at: '2026-10-01T09:00:00Z' },
  ...extra,
});
const first = running('first-id', 2), second = running('second-id', 5);
type Reply = { status?: number; body: unknown };
let routes: Record<string, Reply>;
let calls: string[];

function install(list: Experiment[], capacity = { active: list.length, limit: 3, can_start: list.length < 3 }) {
  routes['GET /api/experiments?status=active'] = { body: list };
  routes['GET /api/experiments/capacity'] = { body: capacity };
  for (const item of list) {
    routes[`GET /api/experiments/${item.id}/progress`] = { body: timelineFixture(item, {}) };
    routes[`GET /api/experiments/${item.id}/checkins`] = { body: [] };
  }
}
const press = (name: string) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  routes = { 'GET /api/profile': { body: profile } };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    calls.push(key);
    const reply = routes[key];
    if (!reply) throw new Error(`Unexpected fake request: ${key}`);
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('your lab with several experiments', () => {
  test('one experiment keeps today\'s screen and never reads the limit', async () => {
    install([first]);
    render(<MobileApp />);
    expect(await screen.findByText('Your observations, day by day.')).toBeVisible();
    expect(screen.queryByText('1 experiments running')).toBeNull();
    expect(calls).not.toContain('GET /api/experiments/capacity');
  });

  test('shows each with its own day and check-in, and checks in on the one chosen', async () => {
    install([first, second]);
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: '2 experiments running' })).toBeVisible();
    expect(screen.getByText(first.question)).toBeVisible();
    expect(screen.getByText(second.question)).toBeVisible();
    expect(screen.getByText('Day 2 of 10')).toBeVisible();
    expect(screen.getByText('Day 5 of 10')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Test another habit' })).toBeVisible();
    await press('Check in for day 5');
    await waitFor(() => expect(calls).toContain('GET /api/experiments/second-id/checkins'));
    expect(calls).not.toContain('GET /api/experiments/first-id/checkins');
  });

  test('See your experiment opens the one chosen', async () => {
    install([first, second]);
    render(<MobileApp />);
    await screen.findByRole('header', { name: '2 experiments running' });
    await act(async () => { fireEvent.press(screen.getAllByRole('button', { name: 'See your experiment' })[1]); });
    expect(await screen.findByText('Your timeline')).toBeVisible();
    expect(screen.getByText(second.question)).toBeVisible();
    expect(screen.queryByText(first.question)).toBeNull();
  });

  test('at the limit there is no new question, and it says why', async () => {
    install([first, second, running('third-id', 7)]);
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: '3 experiments running' })).toBeVisible();
    expect(screen.getByText("You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Test another habit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Design my experiment' })).toBeNull();
  });

  test('one failed read shows the error and Try again, never a partial list', async () => {
    install([first, second]);
    routes['GET /api/experiments/second-id/progress'] = { status: 503, body: { detail: 'Database unavailable' } };
    render(<MobileApp />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByText(first.question)).toBeNull();
    routes['GET /api/experiments/second-id/progress'] = { body: timelineFixture(second, {}) };
    await press('Try again');
    expect(await screen.findByText(first.question)).toBeVisible();
  });

  test('a running sample stays labelled and removable, whichever position it is in', async () => {
    install([first, running('sample-id', 5, { is_seeded: true, question: 'Sample: a walk?' })]);
    render(<MobileApp />);
    expect(await screen.findByRole('button', { name: 'Remove sample' })).toBeVisible();
    expect(screen.getByText('Remove the sample to free up a slot for a real experiment.')).toBeVisible();
  });

  test('a reminder tap opens the check-in of the experiment it belongs to', async () => {
    install([first, second]);
    render(<MobileApp />);
    await screen.findByRole('header', { name: '2 experiments running' });
    await act(async () => { responses.forEach(listener => listener(tapReminder('fake-user', 'second-id'))); });
    await waitFor(() => expect(calls).toContain('GET /api/experiments/second-id/checkins'));
    expect(calls).not.toContain('GET /api/experiments/first-id/checkins');
  });
});

describe('reminders for several experiments', () => {
  const at = (experimentItem: Experiment, nextDayAt: string) => ({ experiment: experimentItem, timeline: timelineFixture(experimentItem, { nextDayAt }) });
  const A = '2027-11-01T06:30:00Z', B = '2027-11-01T19:00:00Z';

  async function enabled() {
    const service = new Reminders();
    notificationState.granted = true;
    await service.setOwner('owner');
    await service.choose(true);
    return service;
  }

  test('schedules one per experiment, each at its own opening and for its own check-in', async () => {
    const service = await enabled();
    await service.refresh([at(first, A), at(second, B)]);
    const scheduled = notifications.scheduleNotificationAsync.mock.calls.map(call => call[0]);
    expect(scheduled.map(request => request.identifier).sort()).toEqual(['rhythm.next-day.first-id', 'rhythm.next-day.second-id']);
    const one = scheduled.find(request => request.identifier === 'rhythm.next-day.first-id');
    const two = scheduled.find(request => request.identifier === 'rhythm.next-day.second-id');
    expect(one?.trigger).toMatchObject({ date: new Date(A) });
    expect(two?.trigger).toMatchObject({ date: new Date(B) });
    expect(two?.content).toMatchObject({ title: 'Day 6 of 10 is open', data: { experiment: 'second-id', owner: 'owner' } });
  });

  test('the lock screen never shows any of the questions', async () => {
    const service = await enabled();
    await service.refresh([at(first, A), at(second, B)]);
    for (const [request] of notifications.scheduleNotificationAsync.mock.calls) {
      expect(JSON.stringify(request.content)).not.toContain('Question');
    }
  });

  test('a finished experiment loses its reminder and the other keeps its own', async () => {
    const service = await enabled();
    await service.refresh([at(first, A), at(second, B)]);
    await service.refresh([at(second, B)]);
    expect([...pending.keys()]).toEqual(['rhythm.next-day.second-id']);
  });

  test('the old single reminder already on a phone is cleared', async () => {
    const service = new Reminders();
    notificationState.granted = true;
    await service.setOwner('owner');
    await service.choose(true);
    pending.set('rhythm.next-day', { identifier: 'rhythm.next-day', content: { data: { owner: 'owner', experiment: 'first-id' } }, trigger: null });
    await service.refresh([at(first, A)]);
    expect(pending.has('rhythm.next-day')).toBe(false);
    expect(pending.has('rhythm.next-day.first-id')).toBe(true);
  });

  test('a sample is skipped without stopping the real experiment\'s reminder', async () => {
    const service = await enabled();
    await service.refresh([at(running('sample-id', 5, { is_seeded: true }), A), at(second, B)]);
    expect([...pending.keys()]).toEqual(['rhythm.next-day.second-id']);
  });

  test('signing out cancels them all', async () => {
    const service = await enabled();
    await service.refresh([at(first, A), at(second, B)]);
    await service.signOut();
    expect([...pending.keys()]).toEqual([]);
  });
});
