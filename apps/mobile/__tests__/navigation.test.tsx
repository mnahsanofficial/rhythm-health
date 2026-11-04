import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState, BackHandler, StyleSheet } from 'react-native';
import { LAYOUT } from '@rhythm-health/brand';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { goTo } from './support/nav';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const QUESTION = 'Does walking after dinner help my mornings?';
const propose = { ...proposeResponse, personal_guess_available: false };
const running = { ...experiment, status: 'active', started_at: '2026-10-25T10:00:00Z', progress: { state: 'in_progress', day_number: 2, phase: 'baseline', phase_day: 2, phase_days: 3, total_days: 10, days_remaining: 8, started_at: '2026-10-25T10:00:00Z', ends_at: '2026-11-04T10:00:00Z' } };
let routes: Record<string, { status?: number; body: unknown }>;
let calls: string[];
let backHandlers: (() => boolean | null | undefined)[];

/** Android's back button: the newest listener goes first. Returns whether the app handled it. */
const hardwareBack = () => act(async () => {
  for (const handler of [...backHandlers].reverse()) if (handler()) return;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  calls = []; backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return { remove: () => { backHandlers = backHandlers.filter(item => item !== handler); } };
  });
  routes = {
    'GET /api/profile': { body: profile },
    'GET /api/experiments?status=active': { body: [] },
    'GET /api/experiments?status=completed': { body: [] },
    'POST /api/experiments/propose': { body: propose },
    'POST /api/demo/reset': { body: writtenLabReport },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    calls.push(key);
    const reply = routes[key];
    if (!reply) return { ok: false, status: 404, json: async () => ({ detail: 'Not found' }) } as Response;
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const press = (name: string | RegExp) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
const signedOut = async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' });
};
const signedIn = async () => { render(<MobileApp />); await screen.findByRole('header', { name: 'Ask a question.' }); };
const withPlan = async () => {
  await signedIn();
  fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
  await press('Design experiment');
  await screen.findByRole('button', { name: 'Start this experiment' });
};
const withRunning = async () => {
  routes['GET /api/experiments?status=active'] = { body: [running] };
  routes[`GET /api/experiments/${running.id}/progress`] = { body: timelineFixture(running as never, { nextDayAt: '2026-10-30T10:00:00Z' }) };
  routes[`GET /api/experiments/${running.id}/checkins`] = { body: [] };
  render(<MobileApp />);
  await screen.findByRole('button', { name: /See your experiment/ });
};
const proposals = () => calls.filter(call => call.endsWith('/propose')).length;

describe('the landing', () => {
  test('has no navbar: the logo sits over the sky, with the theme as a quiet labelled icon', async () => {
    await signedOut();
    expect(screen.queryByTestId('app-header')).toBeNull();
    const logo = screen.getByTestId('landing-logo');
    expect(within(logo).getByText('Rhythm')).toBeVisible();
    expect(StyleSheet.flatten(logo.props.style)).toMatchObject({ alignItems: 'center' });
    const theme = screen.getByRole('button', { name: /^Theme: / });
    expect((StyleSheet.flatten(theme.props.style) as { minHeight: number }).minHeight).toBeGreaterThanOrEqual(LAYOUT.primaryAction);
    expect(screen.queryByTestId('landing-theme-text')).toBeNull();
  });

  test('the logo and the icon stay readable as the sky changes from night to day', async () => {
    await signedOut();
    const color = () => StyleSheet.flatten(within(screen.getByTestId('landing-logo')).getByText('Rhythm').props.style).color;
    const night = color();
    await press('Go to slide 2 of 4');
    expect(color()).not.toBe(night);
  });
});

describe('the logo in the app', () => {
  test('is a home link with a name, going to your lab when signed in', async () => {
    await signedIn();
    await goTo('History');
    await screen.findByRole('header', { name: 'Your experiment history' });
    await act(async () => { fireEvent.press(screen.getByRole('link', { name: 'Rhythm, home' })); });
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  });

  test('goes to the landing page when signed out', async () => {
    await signedOut();
    await press('Sign in');
    await act(async () => { fireEvent.press(screen.getByRole('link', { name: 'Rhythm, home' })); });
    expect(await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' })).toBeVisible();
  });
});

describe('main sections and detail screens', () => {
  test.each([['History', 'Your experiment history'], ['Demo', 'Explore a sample experiment.']])('%s has no back control, and Android back returns to your lab', async (section, heading) => {
    await signedIn();
    await goTo(section);
    await screen.findByRole('header', { name: heading });
    expect(screen.queryByRole('button', { name: /^Back to / })).toBeNull();
    expect(screen.queryByText(/[←‹]/)).toBeNull();
    await hardwareBack();
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  });

  test('Daily reminders has no back control either', async () => {
    await signedIn();
    await goTo('Daily reminders');
    await screen.findByRole('switch', { name: 'Daily reminders' });
    expect(screen.queryByText(/[←‹]/)).toBeNull();
  });

  test('your lab leaves Android back to the system', async () => {
    await signedIn();
    expect(backHandlers.every(handler => !handler())).toBe(true);
  });

  test('an experiment has one link naming where it goes, and Android back does the same', async () => {
    await withRunning();
    await press(/See your experiment/);
    const link = await screen.findByRole('button', { name: 'Back to your lab' });
    expect(within(link).getByText('‹ Your lab')).toBeVisible();
    await hardwareBack();
    expect(await screen.findByRole('button', { name: /See your experiment/ })).toBeVisible();
  });
});

describe('flows close with one ×', () => {
  test('sign in closes to the landing, from the × and from Android back', async () => {
    await signedOut();
    await press('Sign in');
    const close = within(screen.getByTestId('app-header')).getByRole('button', { name: 'Close' });
    expect((StyleSheet.flatten(close.props.style) as { minHeight: number }).minHeight).toBeGreaterThanOrEqual(LAYOUT.primaryAction);
    expect(screen.queryByText(/[←‹]/)).toBeNull();
    await act(async () => { fireEvent.press(close); });
    await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' });
    await press('Start an experiment');
    await screen.findByLabelText('Email');
    await hardwareBack();
    expect(await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' })).toBeVisible();
  });

  test('the first time through onboarding has nowhere to close to', async () => {
    routes['GET /api/profile'] = { status: 404, body: { detail: 'Profile not found' } };
    render(<MobileApp />);
    await screen.findByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  test('updating your rhythm: unchanged closes at once, and a change asks first', async () => {
    await signedIn();
    await goTo('Update your rhythm');
    await screen.findByText("Here's your rhythm.");
    expect(screen.queryByRole('button', { name: 'Cancel setup changes' })).toBeNull();
    await press('Close');
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  test('a question opened from your lab: empty closes at once, and typed words ask first', async () => {
    await withRunning();
    await press('Test another habit');
    await screen.findByRole('header', { name: 'Ask a question.' });
    await press('Close');
    expect(await screen.findByRole('button', { name: /See your experiment/ })).toBeVisible();
    await press('Test another habit');
    fireEvent.changeText(await screen.findByLabelText('Your question or goal'), QUESTION);
    await press('Close');
    expect(screen.getByText('Leave without saving?')).toBeVisible();
    expect(screen.getByText("Your question won't be kept.")).toBeVisible();
    await press('Stay');
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
    await hardwareBack();
    expect(screen.getByText('Leave without saving?')).toBeVisible();
    // With the sheet open, Android back is the same as Stay.
    await hardwareBack();
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
    await press('Close');
    await press('Leave');
    expect(await screen.findByRole('button', { name: /See your experiment/ })).toBeVisible();
    expect(proposals()).toBe(0);
  });

  test('a proposal that cost a call asks before going, and closing never sends another', async () => {
    await withPlan();
    expect(proposals()).toBe(1);
    await press('Close');
    expect(screen.getByText("Your proposal won't be kept.")).toBeVisible();
    await press('Stay');
    expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeVisible();
    await hardwareBack();
    expect(screen.getByText("Your proposal won't be kept.")).toBeVisible();
    await press('Leave');
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe('');
    expect(proposals()).toBe(1);
    expect(calls.filter(call => call.startsWith('POST /api/experiments') && !call.endsWith('/propose'))).toEqual([]);
  });

  test('a proposal stays safe while you look at another section, and the logo brings you back to it', async () => {
    await withPlan();
    await goTo('History');
    await screen.findByRole('header', { name: 'Your experiment history' });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('link', { name: 'Rhythm, home' })); });
    expect(await screen.findByRole('button', { name: 'Start this experiment' })).toBeVisible();
    expect(proposals()).toBe(1);
  });

  test('the check-in closes with ×, asking only once something is answered', async () => {
    await withRunning();
    await press(/Check in for day/);
    await screen.findByRole('header', { name: "Today's check-in." });
    expect(screen.queryByText(/[←‹]/)).toBeNull();
    await press('Close');
    expect(await screen.findByRole('button', { name: /See your experiment/ })).toBeVisible();
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    await press(/Check in for day/);
    await screen.findByRole('header', { name: "Today's check-in." });
    const metric = experiment.metrics[0];
    expect(metric).toBeDefined();
    const choice = screen.getAllByRole('radio')[0];
    await act(async () => { fireEvent.press(choice); });
    await press('Close');
    expect(screen.getByText("Your answers won't be kept.")).toBeVisible();
  });
});
