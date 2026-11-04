import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Experiment } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile, proposeResponse } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ID = experiment.id;
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const running = (progress: Partial<Experiment['progress']>): Experiment => ({ ...experiment, status: 'active', progress: { ...experiment.progress, state: 'in_progress', started_at: '2026-10-01T09:00:00Z', ...progress } });
const baselineDay = running({ day_number: 2, phase: 'baseline', phase_day: 2, phase_days: 3, days_remaining: 8 });
const testDay = running({ day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7, days_remaining: 6 });
const saved = { id: 'saved-checkin', experiment_id: ID, day_number: 4, phase: 'intervention', metric_values: { morning_energy: 7, sleep_quality: 6 }, intervention_completed: true, note: null, created_at: '2026-11-03T09:00:00Z', updated_at: '2026-11-03T09:00:00Z' };

let routes: Record<string, { status?: number; body: unknown }>;
let calls: string[];
beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  calls = [];
  routes = {
    'GET /api/profile': { body: { ...profile, goals: ['Better focus'] } },
    'GET /api/experiments?status=active': { body: [testDay] },
    [`GET /api/experiments/${ID}/progress`]: { body: timelineFixture(testDay, {}) },
    [`GET /api/experiments/${ID}/checkins`]: { body: [] },
    [`POST /api/experiments/${ID}/checkins`]: { body: saved },
  };
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
const press = (name: string) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
async function openCheckin(day = 4) {
  render(<MobileApp />);
  const start = await screen.findByRole('button', { name: `Check in now, day ${day}` });
  await act(async () => { fireEvent.press(start); });
  await screen.findByLabelText('Optional note');
}
const answerAll = () => {
  fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Sleep quality: 6' }));
};

describe('check-in', () => {
  test('a test day uses the web heading, phase line and lead', async () => {
    await openCheckin();
    expect(screen.getByText(/Test day 1 of 7$/)).toBeVisible();
    expect(screen.getByText('Test day: tell us how it went.')).toBeVisible();
    expect(screen.getByText(`When: ${experiment.intervention.timing}`)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(screen.getByText('Anything unusual? (optional)')).toBeVisible();
  });

  test('a normal day says not to change anything', async () => {
    routes['GET /api/experiments?status=active'] = { body: [baselineDay] };
    routes[`GET /api/experiments/${ID}/progress`] = { body: timelineFixture(baselineDay, {}) };
    await openCheckin(2);
    expect(screen.getByText(/Baseline day 2 of 3$/)).toBeVisible();
    expect(screen.getByText('Normal day: change nothing, just notice.')).toBeVisible();
  });

  test('counts answers as they are given, including the test-day question', async () => {
    await openCheckin();
    expect(screen.getByText('0 of 3 answered')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Check-in answers' }).props.accessibilityValue).toMatchObject({ now: 0, max: 3 });
    fireEvent.press(screen.getByRole('radio', { name: 'Not today' }));
    expect(screen.getByText('1 of 3 answered')).toBeVisible();
    answerAll();
    expect(screen.getByText('3 of 3 answered')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Check-in answers' }).props.accessibilityValue).toMatchObject({ now: 3, max: 3 });
  });

  test('the main measure comes first', async () => {
    const metrics = [...experiment.metrics].reverse();
    routes['GET /api/experiments?status=active'] = { body: [{ ...testDay, metrics }] };
    await openCheckin();
    const labels = screen.getAllByTestId('metric-label').map(node => node.props.children);
    expect(labels).toEqual(['Morning energy', 'Sleep quality']);
  });

  test('saying so before replacing today, and the button says Update', async () => {
    routes[`GET /api/experiments/${ID}/checkins`] = { body: [saved] };
    await openCheckin();
    expect(screen.getByText("You've already checked in today. Saving again replaces those answers.")).toBeVisible();
    expect(screen.getByRole('button', { name: "Update check-in" })).toBeVisible();
    expect(screen.getByText('3 of 3 answered')).toBeVisible();
  });

  test('saving celebrates with server counts, then returns to Today', async () => {
    await openCheckin();
    answerAll();
    routes[`GET /api/experiments/${ID}/progress`] = { body: timelineFixture(testDay, { recorded: [1, 2, 3, 4] }) };
    await press("Save check-in");
    expect(await screen.findByText('6 days left')).toBeVisible();
    await press('Continue');
    expect(await screen.findByText('Day 4 recorded')).toBeVisible();
    expect(screen.getByText('4 logged')).toBeVisible();
  });

  test('Edit answers on Today reopens the form', async () => {
    await openCheckin();
    answerAll();
    routes[`GET /api/experiments/${ID}/progress`] = { body: timelineFixture(testDay, { recorded: [4] }) };
    await press("Save check-in");
    await screen.findByText('6 days left');
    await press('Continue');
    await press("Edit answers");
    expect(await screen.findByLabelText('Optional note')).toBeVisible();
  });

  test('if the refresh fails, the saved check-in stays saved and is not sent again', async () => {
    await openCheckin();
    answerAll();
    const fake = global.fetch as jest.Mock; const original = fake.getMockImplementation()!;
    fake.mockImplementation(async (url, options) => {
      const reply = await original(url, options);
      if (options?.method === 'POST') routes[`GET /api/experiments/${ID}/progress`] = { status: 503, body: {} };
      return reply;
    });
    await press("Save check-in");
    expect((await screen.findAllByText('Day 4 recorded'))[0]).toBeVisible();
    await waitFor(() => expect(calls.filter(call => call === `GET /api/experiments/${ID}/progress`).length).toBeGreaterThan(1));
    expect(screen.queryByText(/days? left/)).toBeNull();
    expect(calls.filter(call => call === `POST /api/experiments/${ID}/checkins`)).toHaveLength(1);
  });
});

describe('onboarding', () => {
  test('every step shows the progress bar, which fills as you go', async () => {
    routes['GET /api/profile'] = { status: 404, body: {} };
    render(<MobileApp />);
    const start = await screen.findByRole('button', { name: 'Start' });
    expect(screen.getByRole('progressbar', { name: 'Setup progress' }).props.accessibilityValue).toMatchObject({ now: 0, max: 7 });
    await act(async () => { fireEvent.press(start); });
    const bar = await screen.findByRole('progressbar', { name: 'Setup progress' });
    expect(bar.props.accessibilityValue).toMatchObject({ now: 1, max: 7, text: 'Question 1 of 7' });
    expect(screen.getByText('1 of 7 · Age')).toBeVisible();
  });
});

describe('question flow', () => {
  beforeEach(() => {
    routes['GET /api/experiments?status=active'] = { body: [] };
    routes['POST /api/experiments/propose'] = { body: { ...proposeResponse, personal_guess_available: true } };
  });

  test('says what to do in one line', async () => {
    render(<MobileApp />);
    expect(await screen.findByText('What do you want to test?')).toBeVisible();
  });

  test('waiting says it may take a while, without claiming live stages', async () => {
    render(<MobileApp />);
    fireEvent.changeText(await screen.findByLabelText('Your question or goal'), 'Does less caffeine improve my focus?');
    let release!: (reply: Response) => void;
    const fake = global.fetch as jest.Mock; const original = fake.getMockImplementation()!;
    fake.mockImplementation((url, options) => String(url).endsWith('/propose') ? new Promise<Response>(resolve => { release = resolve; }) : original(url, options));
    await press('Design experiment');
    const panel = await screen.findByText('Finding a small change you can test…');
    expect(panel).toBeVisible();
    expect(screen.getByText('This can take a little while.')).toBeVisible();
    await act(async () => { release({ ok: true, status: 200, json: async () => routes['POST /api/experiments/propose'].body } as Response); });
  });

  test('the plan draws its days, and says them in words', async () => {
    routes['POST /api/experiments/propose'] = { body: proposeResponse };
    render(<MobileApp />);
    fireEvent.changeText(await screen.findByLabelText('Your question or goal'), 'Does less caffeine improve my focus?');
    await press('Design experiment');
    expect(await screen.findByTestId('plan-days')).toBeVisible();
    expect(screen.getByText('3 normal days, then 7 test days')).toBeVisible();
    expect(screen.getByLabelText('Days 1 to 3 are baseline. Days 4 to 10 are test days.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeVisible());
  });

  test('the sample section uses the web wording', async () => {
    render(<MobileApp />);
    expect(await screen.findByText('Try a sample')).toBeVisible();
    expect(screen.getByText('It never counts as your data.')).toBeVisible();
  });
});
