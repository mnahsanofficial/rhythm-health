import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MOTION_DURATION_MS } from '@rhythm-health/brand';
import { Celebration } from '../src/celebration';
import { FIRST_RUN_KEY, FirstRunGuide } from '../src/first-run-guide';
import { writeDraft } from '../src/lib/onboarding';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const OWNER = 'fake-user';
const session = { access_token: 'fake-token', user: { id: OWNER, email: 'learner@example.invalid' } };
const running = { ...experiment, id: 'running-id', status: 'active', started_at: '2026-11-01T10:00:00Z', progress: { state: 'in_progress', day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7, total_days: 10, days_remaining: 6, started_at: '2026-11-01T10:00:00Z', ends_at: '2026-11-11T10:00:00Z' } };
let routes: Record<string, { status?: number; body: unknown }>;
let requests: string[];
const preferences = () => jest.requireActual('./support/notifications').preferences as Map<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  requests = [];
  routes = {
    'GET /api/profile': { body: profile },
    'GET /api/experiments?status=active': { body: [running] },
    [`GET /api/experiments/${running.id}/progress`]: { body: timelineFixture(running as never, { recorded: [1, 3], missed: [2], nextDayAt: '2026-11-05T10:00:00Z' }) },
    [`GET /api/experiments/${running.id}/checkins`]: { body: [] },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    requests.push(key);
    const reply = routes[key];
    if (!reply) return { ok: false, status: 404, json: async () => ({ detail: `Not mocked: ${key}` }) } as Response;
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the celebration', () => {
  const show = async (props: Partial<Parameters<typeof Celebration>[0]> = {}) => {
    const onDone = jest.fn();
    render(<Celebration day={4} totalDays={10} recordedDays={4} daysLeft={6} seeded={false} onDone={onDone} {...props} />);
    await act(async () => { await Promise.resolve(); });
    return onDone;
  };

  test('says which day was recorded and how many are left, with one light haptic', async () => {
    await show();
    expect(screen.getByRole('header', { name: 'Day 4 recorded' })).toBeVisible();
    expect(screen.getByText('6 days left')).toBeVisible();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(screen.queryByText(/nice work|great job|well done|amazing/i)).toBeNull();
  });

  test('goes on by itself after two seconds', async () => {
    jest.useFakeTimers();
    const onDone = await show();
    expect(MOTION_DURATION_MS.celebration).toBe(2000);
    act(() => { jest.advanceTimersByTime(1999); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('a tap anywhere skips it, once', async () => {
    jest.useFakeTimers();
    const onDone = await show();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('with a screen reader on, it waits for a tap', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    jest.useFakeTimers();
    const onDone = await show();
    act(() => { jest.advanceTimersByTime(10000); });
    expect(onDone).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('Day 4 recorded. 6 days left.');
  });

  test('before the refreshed count arrives it says only the day, and invents nothing', async () => {
    await show({ daysLeft: null, recordedDays: null });
    expect(screen.getByRole('header', { name: 'Day 4 recorded' })).toBeVisible();
    expect(screen.queryByText(/days? left/)).toBeNull();
  });

  test.each([[1, '1 day left'], [0, 'That was the last day.']])('with %s left it says so plainly', async (daysLeft, words) => {
    await show({ daysLeft });
    expect(screen.getByText(words)).toBeVisible();
  });

  test('labels a sample', async () => {
    await show({ seeded: true });
    expect(screen.getByText('Example')).toBeVisible();
  });

  test('with Reduce Motion, the sun is already at its final place on the ring', async () => {
    await show({ recordedDays: 5 });
    const { transform } = screen.getByTestId('celebration-marker', { includeHiddenElements: true }).props.style.at(-1);
    expect(transform).toEqual([{ rotate: '180deg' }]);
  });

  test('a real save shows it, then Today with the refreshed day', async () => {
    render(<MobileApp />);
    fireEvent.press(await screen.findByRole('button', { name: 'Check in now, day 4' }));
    await screen.findByRole('button', { name: 'Save check-in' });
    fireEvent.press(screen.getByRole('radio', { name: 'Not today' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Sleep quality: 7' }));
    routes[`POST /api/experiments/${running.id}/checkins`] = { body: { id: 'saved' } };
    routes[`GET /api/experiments/${running.id}/progress`] = { body: timelineFixture(running as never, { recorded: [1, 3, 4], missed: [2], nextDayAt: '2026-11-05T10:00:00Z' }) };
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save check-in' })); });
    expect(await screen.findByText('6 days left')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
    expect(screen.queryByText('6 days left')).toBeNull();
    expect(await screen.findByRole('tab', { name: 'Today', selected: true })).toBeVisible();
  });
});

describe('the Today card', () => {
  test('leads with the day and one action, and says when the day closes', async () => {
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: 'Day 4 of 10' })).toBeVisible();
    expect(screen.getByText('Check in now')).toBeVisible();
    expect(screen.getByText(/^Closes .+\. About 30 seconds\.$/)).toBeVisible();
    expect(screen.queryByText(/tonight/i)).toBeNull();
  });

  test('shows missed days truthfully, without shame', async () => {
    render(<MobileApp />);
    expect(await screen.findByText('2 logged, 1 missed')).toBeVisible();
    expect(screen.queryByText(/streak|don't break|oops|sorry|behind/i)).toBeNull();
  });

  test('with nothing missed, it says only what was logged', async () => {
    routes[`GET /api/experiments/${running.id}/progress`] = { body: timelineFixture(running as never, { recorded: [1, 2, 3], nextDayAt: '2026-11-05T10:00:00Z' }) };
    render(<MobileApp />);
    expect(await screen.findByText('3 logged')).toBeVisible();
  });

  test('once recorded, it says so and when the next day opens', async () => {
    routes[`GET /api/experiments/${running.id}/progress`] = { body: timelineFixture(running as never, { recorded: [1, 3, 4], missed: [2], nextDayAt: '2026-11-05T10:00:00Z' }) };
    render(<MobileApp />);
    expect(await screen.findByRole('header', { name: 'Day 4 recorded' })).toBeVisible();
    expect(screen.getByText(/^Day 5 opens /)).toBeVisible();
    expect(screen.queryByText('Check in now')).toBeNull();
  });
});

describe('the first-run guide', () => {
  const answers = { age_range: '25-34', usual_sleep_schedule: { bedtime: '23:30', wake_time: '07:00' }, usual_sleep_hours: 7, activity_level: 'lightly_active', goals: ['Better focus'], regular_habits: [], constraints: [] };

  test('walks through three steps by doing them, on an example that is never saved', async () => {
    const onDone = jest.fn();
    render(<FirstRunGuide onDone={onDone} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Example · Step 1 of 3')).toBeVisible();
    fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    expect(screen.getByText('Example · Step 2 of 3')).toBeVisible();
    fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    expect(screen.getByText('Example · Step 3 of 3')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save example' })); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(preferences().get(FIRST_RUN_KEY)).toBe('seen');
  });

  test.each([1, 2, 3])('can be skipped from step %s, and that counts as seen', async step => {
    const onDone = jest.fn();
    render(<FirstRunGuide onDone={onDone} />);
    if (step > 1) fireEvent.press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    if (step > 2) fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Skip' })); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(preferences().get(FIRST_RUN_KEY)).toBe('seen');
  });

  const finishSetup = async () => {
    routes['GET /api/profile'] = { status: 404, body: {} };
    routes['PUT /api/profile'] = { body: profile };
    routes['GET /api/experiments?status=active'] = { body: [] };
    await writeDraft(OWNER, { draft: answers, step: 8, editing: false } as never);
    render(<MobileApp />);
    const save = await screen.findByRole('button', { name: 'Save my rhythm' });
    await act(async () => { fireEvent.press(save); });
  };

  test('appears after setup the first time, then Today', async () => {
    await finishSetup();
    expect(await screen.findByText('Example · Step 1 of 3')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Skip' })); });
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  });

  test('is remembered on the device', async () => {
    preferences().set(FIRST_RUN_KEY, 'seen');
    await finishSetup();
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.queryByText(/^Example · Step/)).toBeNull();
  });

  test('never appears for someone who already has a profile', async () => {
    routes['GET /api/experiments?status=active'] = { body: [] };
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Ask a question.' });
    expect(screen.queryByText(/^Example · Step/)).toBeNull();
  });
});
