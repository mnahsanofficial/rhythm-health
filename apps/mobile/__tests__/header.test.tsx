import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, ScrollView, StyleSheet } from 'react-native';
import { LAYOUT } from '@rhythm-health/brand';
import { MobileApp } from '../src/mobile-app';
import { profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { goTo, openMenu } from './support/nav';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const QUESTION = 'Does walking after dinner help my mornings?';
const demo = { ...writtenLabReport, experiment: { ...writtenLabReport.experiment, id: 'demo-id', is_seeded: true } };
let routes: Record<string, { status?: number; body: unknown }>;
let calls: string[];

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  calls = [];
  routes = {
    'GET /api/profile': { body: profile },
    'GET /api/experiments?status=active': { body: [] },
    'GET /api/experiments?status=completed': { body: [] },
    'POST /api/experiments/propose': { body: { ...proposeResponse, personal_guess_available: true } },
    'POST /api/demo/reset': { body: demo },
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

const signedIn = async () => { render(<MobileApp />); await screen.findByText('Nothing running yet.'); };

test('signed out, the header is only the mark and the name', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<MobileApp />);
  await screen.findByLabelText('Email');
  expect(screen.getByTestId('app-header')).toBeVisible();
  expect(within(screen.getByTestId('app-header')).getByText('Rhythm')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Account menu/ })).toBeNull();
});

test('the header is pinned outside the scrolling content', async () => {
  await signedIn();
  const scroller = screen.UNSAFE_getByType(ScrollView);
  expect(within(scroller).queryByTestId('app-header')).toBeNull();
  expect(screen.getByTestId('app-header')).toBeVisible();
});

test('signed in, the bar holds the name and one account button with the initial, not tabs', async () => {
  await signedIn();
  const header = within(screen.getByTestId('app-header'));
  expect(header.getByRole('button', { name: 'Account menu for learner@example.invalid' })).toBeVisible();
  expect(header.getByText('l')).toBeVisible();
  for (const name of ['Today', 'Your lab', 'Progress', 'History', 'Demo', 'Settings']) expect(screen.queryByRole('button', { name })).toBeNull();
});

test('the panel matches the web: sections, the email, Update your rhythm and Sign out', async () => {
  await signedIn();
  await openMenu();
  expect(screen.getByRole('button', { name: /^Account menu/ }).props.accessibilityState).toMatchObject({ expanded: true });
  for (const name of ['Your lab', 'History', 'Demo', 'Update your rhythm', 'Daily reminders', 'Sign out']) expect(screen.getByRole('button', { name })).toBeVisible();
  expect(screen.getByText('Signed in as')).toBeVisible();
  expect(screen.getByText('learner@example.invalid')).toBeVisible();
});

test('the current section is marked and choosing one closes the panel', async () => {
  await signedIn();
  await openMenu();
  expect(screen.getByRole('button', { name: 'Your lab', selected: true })).toBeVisible();
  expect(screen.getByRole('button', { name: 'History', selected: false })).toBeVisible();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'History' })); });
  expect(await screen.findByRole('header', { name: 'Your experiment history' })).toBeVisible();
  expect(screen.queryByText('Signed in as')).toBeNull();
  await openMenu();
  expect(screen.getByRole('button', { name: 'History', selected: true })).toBeVisible();
});

test('tapping outside closes the panel without going anywhere', async () => {
  await signedIn();
  await openMenu();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Close menu' })); });
  expect(screen.queryByText('Signed in as')).toBeNull();
  expect(screen.getByText('Nothing running yet.')).toBeVisible();
});

test('the panel controls have 48pt targets', async () => {
  await signedIn();
  await openMenu();
  for (const name of ['Your lab', 'History', 'Demo', 'Update your rhythm', 'Daily reminders', 'Sign out']) {
    expect((StyleSheet.flatten(screen.getByRole('button', { name }).props.style) as { minHeight: number }).minHeight).toBeGreaterThanOrEqual(LAYOUT.primaryAction);
  }
});

test('Demo is its own section, as on the web, and opens the labelled report', async () => {
  await signedIn();
  expect(screen.queryByRole('button', { name: 'Explore a completed example' })).toBeNull();
  await goTo('Demo');
  expect(await screen.findByRole('header', { name: 'Explore a sample experiment.' })).toBeVisible();
  expect(screen.getByText('See how a completed experiment becomes a Lab Report. The demo uses labelled sample data.')).toBeVisible();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Explore a completed example' })); });
  expect(await screen.findByText('Sample experiment')).toBeVisible();
  expect(calls.filter(call => call.endsWith('/propose') || (call.startsWith('POST') && call.endsWith('/report')))).toEqual([]);
});

test('Daily reminders has its own screen, without repeating the panel', async () => {
  await signedIn();
  await goTo('Daily reminders');
  expect(await screen.findByRole('switch', { name: 'Daily reminders' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Update your rhythm' })).toBeNull();
});

test('the panel opens the saved rhythm and signs out', async () => {
  await signedIn();
  await goTo('Update your rhythm');
  expect(await screen.findByText("Here's your rhythm.")).toBeVisible();
  await goTo('Sign out');
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('a section reached while editing the rhythm leaves the editor', async () => {
  await signedIn();
  await goTo('Update your rhythm');
  await screen.findByText("Here's your rhythm.");
  await goTo('History');
  expect(await screen.findByRole('header', { name: 'Your experiment history' })).toBeVisible();
  expect(screen.queryByText("Here's your rhythm.")).toBeNull();
});

test('leaving for another section keeps a paid proposal, and coming back sends nothing', async () => {
  await signedIn();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Ask a question' })); });
  fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design my experiment' })); });
  fireEvent.changeText(await screen.findByLabelText('Your guess for Morning energy'), '10');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Reveal the AI prediction' })); });
  await screen.findByRole('button', { name: 'Start this experiment' });
  await goTo('History');
  await screen.findByRole('header', { name: 'Your experiment history' });
  expect(screen.queryByRole('button', { name: 'Start this experiment' })).toBeNull();
  await goTo('Your lab');
  expect(await screen.findByRole('button', { name: 'Start this experiment' })).toBeVisible();
  expect(screen.getByText('Your guess: +10% change from normal days. Locked before the AI reveal.')).toBeVisible();
  expect(calls.filter(call => call.endsWith('/propose'))).toHaveLength(1);
});

test('before a profile exists the panel offers only signing out', async () => {
  routes['GET /api/profile'] = { status: 404, body: {} };
  render(<MobileApp />);
  await screen.findByRole('button', { name: 'Start' });
  await openMenu();
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Update your rhythm' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0);
});

test('back links read like the web', async () => {
  await signedIn();
  await goTo('History');
  expect(await screen.findByText('← Your lab')).toBeVisible();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Back to your lab' })); });
  await waitFor(() => expect(screen.getByText('Nothing running yet.')).toBeVisible());
});
