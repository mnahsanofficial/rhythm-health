import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
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
let listeners: Set<(state: AppStateStatus) => void>;

const scale = { type: 'scale', min: 1, max: 10, primary: false, min_label: 'Low point', max_label: 'High point' };
function dueToday(list: Experiment[], all_recorded = false) {
  return {
    revision: 'rev-1', note: null, all_recorded,
    experiments: list.map((item, index) => ({ id: item.id, question: item.question, action: `Change ${index + 1}`, timing: 'After dinner', day_number: index + 1, total_days: 10, phase: index === 1 ? 'intervention' : 'baseline', change_required: index === 1, change_made: null, recorded: all_recorded })),
    questions: list.length ? [
      { id: `${list[0].id}:energy`, experiment_ids: list.map(item => item.id), value: null, metric: { key: 'energy', label: 'Morning energy', ...scale } },
      { id: `${list[0].id}:focus`, experiment_ids: [list[0].id], value: null, metric: { key: 'focus', label: 'Focus', ...scale } },
    ] : [],
  };
}

function install(list: Experiment[], capacity = { active: list.length, limit: 3, can_start: list.length < 3 }) {
  routes['GET /api/experiments?status=active'] = { body: list };
  routes['GET /api/experiments/capacity'] = { body: capacity };
  routes['GET /api/checkins/today'] = { body: dueToday(list.filter(item => !item.is_seeded)) };
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
  listeners = new Set();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; });
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

const press2 = async (name: string) => { const node = await screen.findByRole('button', { name }); await act(async () => { fireEvent.press(node); }); };

describe('your lab with several experiments', () => {
  test('one experiment keeps today\'s screen and never reads the limit', async () => {
    install([first]);
    render(<MobileApp />);
    expect(await screen.findByText(first.question)).toBeVisible();
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
    await press('Check in now, day 5');
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

  test('an open experiment that finishes elsewhere closes, and never turns into the other one', async () => {
    install([first, second]);
    render(<MobileApp />);
    await screen.findByRole('header', { name: '2 experiments running' });
    await act(async () => { fireEvent.press(screen.getAllByRole('button', { name: 'See your experiment' })[0]); });
    expect(await screen.findByText('Your timeline')).toBeVisible();
    routes['GET /api/experiments?status=active'] = { body: [second] };
    await act(async () => { listeners.forEach(listener => listener('active')); });
    await waitFor(() => expect(screen.queryByText('Your timeline')).toBeNull());
    expect(screen.getByText(second.question)).toBeVisible();
  });

  test('two experiments both on day 1 keep their own keys, on Today and in the combined check-in', async () => {
    const warn = jest.spyOn(console, 'error');
    install([running('first-id', 1), running('second-id', 1)]);
    render(<MobileApp />);
    expect(await screen.findByText('One check-in for all 2 experiments.')).toBeVisible();
    expect(screen.getByText('Question first-id?')).toBeVisible();
    expect(screen.getByText('Question second-id?')).toBeVisible();
    await press('Check in for today');
    expect(await screen.findByRole('header', { name: "Today's check-in." })).toBeVisible();
    expect(warn.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([]);
  });

  test('one check-in saves everything due today in one request', async () => {
    install([first, second]);
    let body: unknown;
    routes['POST /api/checkins/today'] = { body: { ...dueToday([first, second], true) } };
    const fake = global.fetch as jest.Mock;
    const base = fake.getMockImplementation()!;
    fake.mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') body = JSON.parse(String(options.body));
      return base(url, options);
    });
    render(<MobileApp />);
    expect(await screen.findByText('One check-in for all 2 experiments.')).toBeVisible();
    await press('Check in for today');
    expect(await screen.findByRole('header', { name: "Today's check-in." })).toBeVisible();
    expect(screen.getByText('For both experiments')).toBeVisible();
    expect(screen.getByText(`For: ${first.question}`)).toBeVisible();
    expect(screen.getAllByText('Did you make the change today?')).toHaveLength(1);
    expect(screen.getByText('Change 2')).toBeVisible();
    await press("Save check-in");
    expect(await screen.findByText('An answer is missing or needs checking. Review the fields below.')).toBeVisible();
    expect(body).toBeUndefined();
    fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    fireEvent.changeText(screen.getByLabelText('Optional note'), ' late night ');
    fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Focus: 6' }));
    await press("Save check-in");
    await waitFor(() => expect(body).toEqual({
      revision: 'rev-1', note: 'late night', changes: { 'second-id': true },
      answers: { 'first-id:energy': 7, 'first-id:focus': 6 },
    }));
    expect(await screen.findByText('2 check-ins recorded')).toBeVisible();
    expect(screen.getAllByText('Day 1 of 10')[0]).toBeVisible(); // Today sits behind it with the same day.
    expect(screen.getAllByText('Day 2 of 10')[0]).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    await press('Continue');
    expect(screen.queryByText('2 check-ins recorded')).toBeNull();
    expect(await screen.findByRole('tab', { name: 'Today', selected: true })).toBeVisible();
  });

  test('updating the combined check-in shows the same celebration', async () => {
    install([first, second]);
    routes['GET /api/checkins/today'] = { body: { ...dueToday([first, second], true) } };
    routes['POST /api/checkins/today'] = { body: { ...dueToday([first, second], true) } };
    render(<MobileApp />);
    await press2('Edit answers');
    expect(await screen.findByRole('header', { name: "Today's check-in." })).toBeVisible();
    fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Focus: 6' }));
    await press('Update check-in');
    expect(await screen.findByText('2 check-ins recorded')).toBeVisible();
  });

  test('a reminder tap leaves the combined check-in for that experiment', async () => {
    install([first, second]);
    render(<MobileApp />);
    await screen.findByText('One check-in for all 2 experiments.');
    await press('Check in for today');
    await screen.findByText('For both experiments');
    await act(async () => { responses.forEach(listener => listener(tapReminder('fake-user', 'second-id'))); });
    await waitFor(() => expect(screen.queryByText('For both experiments')).toBeNull());
    expect(calls).toContain('GET /api/experiments/second-id/checkins');
  });

  test('a stale form offers to reload instead of saving on the wrong day', async () => {
    install([first, second]);
    routes['POST /api/checkins/today'] = { status: 409, body: { detail: { code: 'checkin_changed', message: "Today's check-in has changed. Reload it to see the current questions." } } };
    render(<MobileApp />);
    await screen.findByText('One check-in for all 2 experiments.');
    await press('Check in for today');
    await screen.findByRole('header', { name: "Today's check-in." });
    fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Focus: 6' }));
    await press("Save check-in");
    expect(await screen.findByText("Today's check-in has changed. Reload it to see the current questions.")).toBeVisible();
    expect(screen.getByRole('button', { name: "Reload today's check-in" })).toBeVisible();
  });

  test('when everything is recorded it says so, and answers can still change', async () => {
    install([first, second]);
    routes['GET /api/checkins/today'] = { body: dueToday([first, second], true) };
    render(<MobileApp />);
    expect(await screen.findByText('Done for today: all 2 check-ins are recorded.')).toBeVisible();
    expect(screen.getByRole('button', { name: "Edit answers" })).toBeVisible();
  });

  test('only one real experiment due means no combined check-in', async () => {
    install([first, running('sample-id', 5, { is_seeded: true })]);
    render(<MobileApp />);
    await screen.findByRole('header', { name: '2 experiments running' });
    expect(screen.queryByRole('button', { name: 'Check in for today' })).toBeNull();
  });

  test('at the limit there is no new question, and it says why', async () => {
    install([first, second, running('third-id', 7)]);
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: '3 experiments running' })).toBeVisible();
    expect(screen.getByText("You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Test another habit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Design experiment' })).toBeNull();
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
    expect(screen.getByText('It never counts as your data.')).toBeVisible();
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
