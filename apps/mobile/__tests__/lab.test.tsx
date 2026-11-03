import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Checkin, Experiment, ExperimentTimeline } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, labReport, profile, proposeResponse } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ID = experiment.id;
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const state = (progress: Partial<Experiment['progress']>): Experiment => ({ ...experiment, status: 'active', progress: { ...experiment.progress, day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0, started_at: '2026-10-01T09:00:00Z', ...progress } });
const baselineDay = state({ state: 'in_progress', day_number: 2, phase: 'baseline', phase_day: 2, phase_days: 3, days_remaining: 8 });
const testDay = state({ state: 'in_progress', day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7, days_remaining: 6 });
const ended = state({ state: 'ended' });
const answer = (day: number, phase: 'baseline' | 'intervention', completed: boolean | null = null): Checkin => ({
  id: `check-${day}`, experiment_id: ID, day_number: day, phase, metric_values: { morning_energy: 7, sleep_quality: 6 }, intervention_completed: completed, note: day === 3 ? 'A quiet day.' : null, created_at: '2026-10-03T09:00:00Z', updated_at: '2026-10-03T09:00:00Z',
} as Checkin);
let routes: Record<string, { status?: number; body: unknown }>;
let calls: string[];
function setActive(current: Experiment, timeline: ExperimentTimeline = timelineFixture(current, {}), checkins: Checkin[] = []) {
  routes['GET /api/experiments?status=active'] = { body: [current] };
  routes[`GET /api/experiments/${ID}/progress`] = { body: timeline };
  routes[`GET /api/experiments/${ID}/checkins`] = { body: checkins };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  calls = [];
  routes = {
    'GET /api/profile': { body: { ...profile, goals: ['Better focus'] } },
    'GET /api/experiments?status=active': { body: [] },
    [`POST /api/experiments/${ID}/complete`]: { body: labReport },
    'POST /api/experiments/propose': { body: proposeResponse },
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

describe('your lab with nothing running', () => {
  test('goes straight to the question, as on the web, with the sample offered above it', async () => {
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try a sample experiment' })).toBeVisible();
    expect(screen.getByText('Start with a hunch')).toBeVisible();
    expect(screen.queryByText('Nothing running yet.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to your lab' })).toBeNull();
    expect(calls.filter(call => call.endsWith('/propose'))).toEqual([]);
  });
});

describe('your lab with an experiment', () => {
  test('shows the day, the question and the routine before the change starts', async () => {
    setActive(baselineDay);
    render(<MobileApp />);
    expect(await screen.findByText('Day 2 of 10')).toBeVisible();
    expect(screen.getByRole('header', { name: experiment.question })).toBeVisible();
    expect(screen.getByText('Keep your usual routine')).toBeVisible();
    expect(screen.getByText('Your change starts on day 4.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'See your experiment' })).toBeVisible();
    expect(screen.getByText("Today's check-in is waiting.")).toBeVisible();
    expect(screen.getByText('A baseline day: just record a normal day. About 30 seconds.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check in for day 2' })).toBeVisible();
  });

  test('a test day names the change, the timing and how many days remain', async () => {
    setActive(testDay);
    render(<MobileApp />);
    expect(await screen.findByText('Your small change')).toBeVisible();
    expect(screen.getByText(`${experiment.intervention.timing} · ${experiment.intervention.frequency}`)).toBeVisible();
    expect(screen.getByText('A test day: tell us whether you made the change, then how it went. About 30 seconds.')).toBeVisible();
    expect(screen.getByText('Test day 1 of 7 · 6 days remaining')).toBeVisible();
  });

  test('a recorded day says so and gives the next opening', async () => {
    setActive(testDay, timelineFixture(testDay, { recorded: [4], nextDayAt: '2026-11-05T18:45:00Z' }), [answer(4, 'intervention', true)]);
    render(<MobileApp />);
    expect(await screen.findByText('Done for today')).toBeVisible();
    expect(screen.getByText('Day 4 is recorded.')).toBeVisible();
    expect(screen.getByRole('button', { name: "Change today's answers" })).toBeVisible();
  });

  test('observations sit on the same screen, with recorded counts from the server', async () => {
    setActive(testDay, timelineFixture(testDay, { recorded: [1, 3, 4], missed: [2], nextDayAt: '2026-11-05T18:45:00Z' }), [answer(1, 'baseline'), answer(3, 'baseline'), answer(4, 'intervention', true)]);
    render(<MobileApp />);
    expect(await screen.findByText('Your observations, day by day.')).toBeVisible();
    expect(screen.getByText('3 of 10 days recorded')).toBeVisible();
    expect(await screen.findByText('Change made on 1 of 1 test days')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Progress' })).toBeNull();
  });

  test('Test another habit designs a second experiment, and the limit leads back to the lab', async () => {
    setActive(testDay);
    routes['POST /api/experiments/propose'] = { status: 409, body: { detail: { code: 'active_limit_reached', message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } } };
    render(<MobileApp />);
    await screen.findByText('Day 4 of 10');
    await press('Test another habit');
    expect(screen.queryByText('Start with a hunch')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), 'Does less caffeine improve my focus?');
    await press('Design my experiment');
    expect(await screen.findByText("You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
    expect(calls.filter(call => call.endsWith('/propose'))).toHaveLength(1);
    await press('Go to Your lab');
    expect(await screen.findByText('Day 4 of 10')).toBeVisible();
  });
});

describe('experiment page', () => {
  const openPage = async (name = 'See your experiment') => {
    render(<MobileApp />);
    const link = await screen.findByRole('button', { name });
    await act(async () => { fireEvent.press(link); });
  };

  test('shows the status, timeline, the small change and the original forecast', async () => {
    setActive(testDay, timelineFixture(testDay, { recorded: [1], missed: [2, 3] }), [answer(1, 'baseline')]);
    await openPage();
    expect(await screen.findByText('Day 4 of 10 · Test day 1 of 7')).toBeVisible();
    expect(screen.getByText('Your timeline')).toBeVisible();
    expect(screen.getByText('The small change')).toBeVisible();
    expect(screen.getByText('Baseline days come first: keep your routine as it is. The change starts on day 4.')).toBeVisible();
    expect(screen.getByText('The original forecast')).toBeVisible();
    expect(screen.getByText('+8% to +15%')).toBeVisible();
    await press('Back to your lab');
    expect(await screen.findByRole('button', { name: 'Test another habit' })).toBeVisible();
  });

  test('finishing lives here, and ended days lead straight to it', async () => {
    setActive(ended);
    render(<MobileApp />);
    expect(await screen.findByText('All 10 days are done.')).toBeVisible();
    expect(screen.queryByText('Ready for your results.')).toBeNull();
    await press('Finish and see results');
    expect(await screen.findByText('Ready for your results.')).toBeVisible();
    await press('Finish and see results');
    await press('Yes, finish');
    expect(await screen.findByRole('button', { name: 'Reveal my result' })).toBeVisible();
    expect(calls.filter(call => call.endsWith('/complete'))).toHaveLength(1);
  });

  test('a check-in from the page returns to the page', async () => {
    setActive(testDay);
    await openPage();
    await screen.findByText('Your timeline');
    await press('Check in for day 4');
    await press('Back to your lab');
    expect(await screen.findByText('Your timeline')).toBeVisible();
  });

  test('choosing a section in the header leaves the page', async () => {
    setActive(testDay);
    await openPage();
    await screen.findByText('Your timeline');
    fireEvent.press(screen.getByRole('button', { name: /^Account menu/ }));
    await press('Your lab');
    await waitFor(() => expect(screen.queryByText('Your timeline')).toBeNull());
    expect(screen.getByRole('button', { name: 'Test another habit' })).toBeVisible();
  });
});

describe('timeline', () => {
  const days = () => timelineFixture(testDay, { recorded: [1, 3], missed: [2] });
  const checkins = [answer(1, 'baseline'), answer(3, 'baseline')];

  test('names each day state like the web, with marks that do not rely on colour', async () => {
    setActive(testDay, days(), checkins);
    render(<MobileApp />);
    expect(await screen.findByRole('button', { name: 'Day 1, baseline, logged' })).toBeVisible();
    expect(screen.getByLabelText('Day 2, baseline, missed')).toBeVisible();
    expect(screen.getByLabelText('Day 4, test, today, not logged yet')).toBeVisible();
    expect(screen.getByLabelText('Day 5, test, upcoming')).toBeVisible();
    expect(screen.getAllByText('✓')).toHaveLength(2);
    expect(screen.getByText('–')).toBeVisible();
    expect(screen.getByText('Today')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Day 5/ })).toBeNull();
    expect(screen.getByText('✓ logged · – missed · tap a logged day to see it')).toBeVisible();
  });

  test('opens on the latest recorded day and swaps on a tap', async () => {
    setActive(testDay, days(), checkins);
    render(<MobileApp />);
    const panel = await screen.findByLabelText('Day 3 answers');
    expect(within(panel).getByText('Day 3 · Baseline')).toBeVisible();
    expect(within(panel).getByText('“A quiet day.”')).toBeVisible();
    await press('Day 1, baseline, logged');
    expect(within(screen.getByLabelText('Day 1 answers')).getByText('7/10')).toBeTruthy();
    expect(screen.queryByLabelText('Day 3 answers')).toBeNull();
  });
});
