import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Platform } from 'react-native';
import { MOTION_DURATION_MS } from '@rhythm-health/brand';
import { writeDraft } from '../src/lib/onboarding';
import { MobileApp } from '../src/mobile-app';
import { goTo, renderToForm } from './support/nav';
import { profile } from '../../../frontend/tests/support/fixtures';

const mockAuth = {
  getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), signOut: jest.fn(),
  onAuthStateChange: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
};
const mockNetwork = { isConnected: true, isInternetReachable: true };
const mockCreateClient = jest.fn(() => ({ auth: mockAuth }));
const mockFonts = { ready: true, error: null as Error | null };
const mockSession = {
  access_token: 'fake-mobile-token', refresh_token: 'fake-refresh',
  user: { id: 'fake-user', email: 'learner@example.invalid' },
};
jest.mock('../src/lib/supabase', () => ({ createAuthClient: (...args: unknown[]) => mockCreateClient(...args as []) }), { virtual: true });
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [mockFonts.ready, mockFonts.error] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
}, { virtual: true });

function chooseTime(label: string, value: string) {
  fireEvent.press(screen.getByRole('button', { name: label }));
  const [hour, minute] = value.split(':').map(Number);
  fireEvent(screen.getByLabelText('Time picker'), 'onChange', { type: 'set' }, new Date(2000, 0, 1, hour, minute));
  fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  mockFonts.ready = true; mockFonts.error = null;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-public-anon-key';
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test.invalid:8001';
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null });
  mockAuth.signUp.mockResolvedValue({ data: { session: mockSession }, error: null });
  mockAuth.signOut.mockResolvedValue({ error: null });
  global.fetch = jest.fn(async (url) => ({ ok: true, status: 200, json: async () => String(url).endsWith('/api/profile') ? profile : [] }) as Response);
});

async function signIn() {
  fireEvent.changeText(await screen.findByLabelText('Email'), '  learner@example.invalid  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'fake-password');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Sign in' })); });
}

test('signs in with existing credentials and loads the profile before Today', async () => {
  await renderToForm();
  await signIn();
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(screen.getByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'learner@example.invalid', password: 'fake-password' });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch).toHaveBeenCalledWith('http://api.test.invalid:8001/api/profile', expect.objectContaining({
    method: 'GET', headers: { Authorization: 'Bearer fake-mobile-token' },
  }));
});

test('requires email and password, and keeps the password masked by default', async () => {
  await renderToForm();
  const email = await screen.findByLabelText('Email');
  const password = screen.getByLabelText('Password');
  expect(password.props.secureTextEntry).toBe(true);
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  fireEvent.changeText(email, 'not-an-email'); fireEvent.changeText(password, 'fake-password');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

test('ignores a second tap while sign-in is pending', async () => {
  let release!: (result: unknown) => void;
  mockAuth.signInWithPassword.mockReturnValue(new Promise(resolve => { release = resolve; }));
  await renderToForm(); await signIn();
  const busy = screen.getByRole('button', { name: 'Signing in…' });
  expect(busy).toBeDisabled(); fireEvent.press(busy);
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
  release({ data: { session: mockSession }, error: null });
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('shows a plain wrong-password error and allows another attempt', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { status: 400 } });
  await renderToForm(); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Email or password wasn't recognised\./);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('shows No connection offline and never sends credentials or a profile request', async () => {
  mockNetwork.isConnected = false;
  await renderToForm();
  expect(await screen.findByText('No connection')).toBeVisible();
  fireEvent.changeText(screen.getByLabelText('Email'), 'learner@example.invalid');
  fireEvent.changeText(screen.getByLabelText('Password'), 'fake-password');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('restores an existing session before rendering private profile content', async () => {
  let release!: (result: unknown) => void;
  mockAuth.getSession.mockReturnValue(new Promise(resolve => { release = resolve; }));
  await renderToForm();
  expect(screen.getByText('Opening your rhythm…')).toBeVisible();
  expect(screen.queryByText('Ask a question.')).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
  release({ data: { session: mockSession }, error: null });
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

test('shows a profile-shaped loading state until the profile request resolves', async () => {
  let release!: (result: unknown) => void;
  const originalFetch = async () => ({ ok: true, status: 200, json: async () => [] }) as Response;
  (global.fetch as jest.Mock).mockImplementation((...args) => String(args[0]).endsWith('/api/profile') ? new Promise(resolve => { release = resolve; }) : originalFetch());
  mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
  await renderToForm();
  expect(await screen.findByText('Loading your profile…')).toBeVisible();
  expect(screen.queryByText('Ask a question.')).toBeNull();
  release({ ok: true, status: 200, json: async () => profile });
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('a missing profile opens native onboarding without creating an account', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  await renderToForm(); await signIn();
  expect(await screen.findByText('First, your rhythm.')).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Set up your rhythm on the web' })).toBeNull();
  expect(mockAuth.signUp).not.toHaveBeenCalled();
  expect(screen.queryByText('Ask a question.')).toBeNull();
});

test('retries an unavailable profile without signing in again', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
  await renderToForm(); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't load your profile\./);
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
});

test('an expired profile session returns to sign-in with a clear message', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
  await renderToForm(); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Sign in again.');
  expect(screen.getByLabelText('Email')).toBeVisible();
  expect(screen.queryByText('Ask a question.')).toBeNull();
});

test('signs out only this device and removes private content', async () => {
  await renderToForm(); await signIn();
  await screen.findByRole('header', { name: 'Ask a question.' });
  await goTo('Sign out');
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByText('Ask a question.')).toBeNull();
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test.each(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])(
  'a blank %s shows its name and never initializes auth', async name => {
    process.env[name] = '   ';
    await renderToForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(name));
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  },
);

test('font loading cannot flash sign-in or private content', () => {
  mockFonts.ready = false;
  render(<MobileApp />);
  expect(screen.getByText('Opening Rhythm…')).toBeVisible();
  expect(screen.getByText('Rhythm')).toHaveStyle({ fontFamily: undefined });
  expect(mockAuth.getSession).not.toHaveBeenCalled();
});

test('font errors offer retry and keep content hidden until resources are ready', async () => {
  mockFonts.ready = false; mockFonts.error = new Error('Fake font failure');
  await renderToForm();
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open Rhythm.");
  mockFonts.ready = true; mockFonts.error = null;
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' })).toBeVisible();
});


async function createAccount() {
  fireEvent.press(await screen.findByRole('link', { name: 'Create an account' }));
  fireEvent.changeText(screen.getByLabelText('Email'), 'new@example.invalid');
  fireEvent.changeText(screen.getByLabelText('Password'), 'fake-password');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create account' })); });
}
async function openSetup() {
  (global.fetch as jest.Mock).mockImplementation(async (url, options) => ({
    ok: options?.method === 'PUT' || !String(url).endsWith('/api/profile'),
    status: options?.method === 'PUT' ? 200 : String(url).endsWith('/api/profile') ? 404 : 200,
    json: async () => options?.method === 'PUT' ? profile : [],
  }));
  mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
  await renderToForm();
  fireEvent.press(await screen.findByRole('button', { name: 'Start' }));
}
async function completeQuestions() {
  fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  chooseTime('Bedtime', '23:30');
  chooseTime('Wake time', '07:00');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('7')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Lightly active/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Better focus' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(await screen.findByText("Here's your rhythm.")).toBeVisible();
}

test('creates an account natively and routes its missing profile to setup', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  await renderToForm(); await createAccount();
  expect(await screen.findByText('First, your rhythm.')).toBeVisible();
  expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'new@example.invalid', password: 'fake-password' });
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

test('matches account validation, password visibility and offline submission guards', async () => {
  await renderToForm();
  fireEvent.press(await screen.findByRole('link', { name: 'Create an account' }));
  fireEvent.changeText(screen.getByLabelText('Email'), 'new@example.invalid');
  fireEvent.changeText(screen.getByLabelText('Password'), '12345');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  fireEvent.changeText(screen.getByLabelText('Password'), '123456');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  expect(mockAuth.signUp).not.toHaveBeenCalled();
});

test('confirmation-required signup returns to sign-in without fetching or saving a profile', async () => {
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await renderToForm(); await createAccount();
  expect(await screen.findByText("We've sent a link to new@example.invalid. Open it to confirm your account, then sign in here.")).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Password')).toHaveProp('value', '');
});

test('signup exposes the auth service error and blocks duplicate taps while pending', async () => {
  let release!: (result: unknown) => void;
  mockAuth.signUp.mockReturnValue(new Promise(resolve => { release = resolve; }));
  await renderToForm(); await createAccount();
  fireEvent.press(screen.getByRole('button', { name: 'Creating your account…' }));
  expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
  await act(async () => { release({ data: { session: null }, error: { message: 'Email rate limit exceeded' } }); });
  expect(screen.getByRole('alert')).toHaveTextContent('Email rate limit exceeded');
  expect(screen.getByLabelText('Email')).toHaveProp('value', 'new@example.invalid');
});

test('onboarding saves the shared profile body with PUT then opens Today', async () => {
  await openSetup(); await completeQuestions();
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(global.fetch).toHaveBeenCalledWith('http://api.test.invalid:8001/api/profile', expect.objectContaining({
    method: 'PUT', headers: { Authorization: 'Bearer fake-mobile-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ age_range: '25-34', usual_sleep_schedule: { bedtime: '23:30', wake_time: '07:00' }, usual_sleep_hours: 7,
      activity_level: 'lightly_active', goals: ['Better focus'], regular_habits: [], constraints: [] }),
  }));
});

test('summary edits preserve answers and return directly to the summary', async () => {
  await openSetup(); await completeQuestions();
  fireEvent.press(screen.getByRole('button', { name: 'Change goals' }));
  expect(screen.getByRole('checkbox', { name: 'Better focus' })).toBeChecked();
  fireEvent.press(screen.getByRole('checkbox', { name: 'Calmer evenings' }));
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByText('Better focus, Calmer evenings')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save my rhythm' })).toBeEnabled();
});

test('invalid time and excessive sleep cannot advance; optional lists and custom goals are bounded', async () => {
  await openSetup();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  chooseTime('Bedtime', '06:00');
  chooseTime('Wake time', '07:00');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  chooseTime('Bedtime', '06:00');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  chooseTime('Bedtime', '23:30');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('button', { name: 'Half an hour more' }));
  expect(screen.getByText('7.5')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Half an hour more' })).toBeDisabled();
});

test('failed profile saves keep answers, show field errors and permit explicit retry only', async () => {
  await openSetup(); await completeQuestions();
  const defaultFetch = (global.fetch as jest.Mock).getMockImplementation()!;
  (global.fetch as jest.Mock).mockImplementationOnce(async () => ({ ok: false, status: 422, json: async () => ({ detail: [{ loc: ['body', 'goals', 0], msg: 'Choose another goal' }] }) }));
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  expect(await screen.findByText(/Your answers are still here/)).toBeVisible();
  expect(screen.getByText(/Choose another goal/)).toBeVisible();
  expect(screen.getByText('Better focus')).toBeVisible();
  (global.fetch as jest.Mock).mockImplementation(defaultFetch);
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('offline signup never creates an account', async () => {
  mockNetwork.isConnected = false;
  await renderToForm(); await createAccount();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  expect(mockAuth.signUp).not.toHaveBeenCalled();
});

test('an expired profile save signs out without losing the owner-scoped setup draft', async () => {
  await openSetup(); await completeQuestions();
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(/Your session has expired/);
  await signIn();
  expect(await screen.findByText("Here's your rhythm.")).toBeVisible();
  expect(screen.getByText('Better focus')).toBeVisible();
});

test('setup restores the same account draft after a restart and never submits twice', async () => {
  await openSetup(); await completeQuestions();
  screen.unmount();
  await renderToForm();
  expect(await screen.findByText("Here's your rhythm.")).toBeVisible();
  let release!: (result: unknown) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  fireEvent.press(screen.getByRole('button', { name: 'Saving…' }));
  const writes = (global.fetch as jest.Mock).mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(writes).toHaveLength(1);
  await act(async () => { release({ ok: true, status: 200, json: async () => profile }); });
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('goal limits, case-insensitive custom choices and optional habits match web behavior', async () => {
  await openSetup(); await completeQuestions();
  fireEvent.press(screen.getByRole('button', { name: 'Change goals' }));
  fireEvent.changeText(screen.getByLabelText('Something else?'), '  better   focus  ');
  fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getAllByRole('checkbox', { name: 'Better focus' })).toHaveLength(1);
  fireEvent.press(screen.getByRole('checkbox', { name: 'Calmer evenings' }));
  fireEvent.changeText(screen.getByLabelText('Something else?'), '  steadier   mornings  ');
  fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByRole('checkbox', { name: 'Steadier mornings' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Better focus' })).toBeEnabled();
  expect(screen.getByRole('checkbox', { name: 'Fall asleep faster' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  fireEvent.press(screen.getByRole('button', { name: 'Change habits' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Phone in bed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByText('Phone in bed · 23:00')).toBeVisible();
});

test('device draft failure is visible and can retry without losing current answers', async () => {
  const storage = jest.requireMock('expo-secure-store');
  await openSetup();
  await act(async () => {});
  storage.setItemAsync.mockRejectedValueOnce(new Error('Fake storage full'));
  fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
  expect(await screen.findByText(/Couldn't keep your setup/)).toBeVisible();
  expect(screen.getByRole('radio', { name: '25–34' })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => {});
  expect(screen.queryByText(/Couldn't keep your setup/)).toBeNull();
});

test('switching accounts cannot restore another account onboarding answers', async () => {
  await openSetup(); await completeQuestions(); screen.unmount();
  mockAuth.getSession.mockResolvedValue({ data: { session: { ...mockSession, user: { id: 'another-user', email: 'other@example.invalid' } } }, error: null });
  await renderToForm();
  expect(await screen.findByText('First, your rhythm.')).toBeVisible();
  expect(screen.queryByText('Better focus')).toBeNull();
});

test('The account panel can reopen the saved rhythm for editing without creating another profile', async () => {
  await renderToForm(); await signIn(); await screen.findByRole('header', { name: 'Ask a question.' });
  await goTo('Update your rhythm');
  expect(await screen.findByText("Here's your rhythm.")).toBeVisible();
  expect(screen.getByText('23:30 to 07:30, about 8 h asleep')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Change goals' }));
  expect(screen.getByRole('checkbox', { name: 'better morning energy' })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel setup changes' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
});

test('cleanup retry after a successful save never repeats the profile write', async () => {
  await openSetup(); await completeQuestions(); await act(async () => {});
  const storage = jest.requireMock('expo-secure-store');
  storage.deleteItemAsync.mockRejectedValueOnce(new Error('Fake cleanup failure'));
  fireEvent.press(screen.getByRole('button', { name: 'Save my rhythm' }));
  expect(await screen.findByText(/Your rhythm is saved. Couldn't remove/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Finish saving' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect((global.fetch as jest.Mock).mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
});

test('explicit sign-out discards this account setup draft', async () => {
  await openSetup(); await completeQuestions();
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByLabelText('Email'); await signIn();
  expect(await screen.findByText('First, your rhythm.')).toBeVisible();
});

test('onboarding remains editable offline and reconnects before saving', async () => {
  await openSetup(); await completeQuestions();
  mockNetwork.isConnected = false; screen.rerender(<MobileApp />);
  expect(await screen.findByText(/No connection. Your answers stay/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save my rhythm' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Change goals' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Calmer evenings' }));
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByText('Better focus, Calmer evenings')).toBeVisible();
  mockNetwork.isConnected = true; screen.rerender(<MobileApp />);
  expect(await screen.findByRole('button', { name: 'Save my rhythm' })).toBeEnabled();
});


test.each([true, false])('rhythm reveal respects reduced motion=%s without delaying summary actions', async reduce => {
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
  try {
    await openSetup(); await completeQuestions(); await act(async () => {});
    expect(screen.getByRole('button', { name: 'Save my rhythm' })).toBeEnabled();
    expect(screen.getByText('23:30 to 07:00, about 7 h asleep')).toBeVisible();
    if (reduce) expect(timing).not.toHaveBeenCalled();
    else expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: MOTION_DURATION_MS.reveal, useNativeDriver: true }));
  } finally { timing.mockRestore(); }
});


test('sleep times use the native time picker and Cancel preserves the existing time', async () => {
  await openSetup();
  fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByDisplayValue('23:30')).toBeNull();
  chooseTime('Bedtime', '23:30');
  fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));
  expect(screen.getByLabelText('Time picker')).toHaveProp('mode', 'time');
  expect(screen.getByLabelText('Time picker').props.value.getHours()).toBe(23);
  fireEvent(screen.getByLabelText('Time picker'), 'onChange', { type: 'set' }, new Date(2000, 0, 1, 22, 0));
  fireEvent.press(screen.getByRole('button', { name: 'Cancel time selection' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));
  expect(screen.getByLabelText('Time picker').props.value.getHours()).toBe(23);
  expect(screen.getByLabelText('Time picker').props.value.getMinutes()).toBe(30);
});


test('Android clock selection commits local time and dismissing leaves it unchanged', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    await openSetup();
    fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));
    expect(screen.getByLabelText('Time picker')).toHaveProp('display', 'clock');
    fireEvent(screen.getByLabelText('Time picker'), 'onChange', { type: 'dismissed' });
    expect(screen.queryByLabelText('Time picker')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));
    fireEvent(screen.getByLabelText('Time picker'), 'onChange', { type: 'set' }, new Date(2000, 0, 1, 23, 45));
    expect(screen.getByText('23:45')).toBeVisible();
    expect(screen.queryByLabelText('Time picker')).toBeNull();
  } finally { os.restore(); }
});


test('the clock picker can recover an incomplete time saved by the earlier manual form', async () => {
  await writeDraft('fake-user', { draft: { age_range: '25-34', usual_sleep_schedule: { bedtime: '2', wake_time: '' } }, step: 2, editing: false });
  mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  await renderToForm();
  fireEvent.press(await screen.findByRole('button', { name: 'Bedtime' }));
  const selected = screen.getByLabelText('Time picker').props.value;
  expect(Number.isFinite(selected.getTime())).toBe(true);
  expect(selected.getHours()).toBe(23);
});
