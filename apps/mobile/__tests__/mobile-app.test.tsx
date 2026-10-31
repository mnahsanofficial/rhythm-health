import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MobileApp } from '../src/mobile-app';
import { profile } from '../../../frontend/tests/support/fixtures';

const mockAuth = {
  getSession: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  mockFonts.ready = true; mockFonts.error = null;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-public-anon-key';
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test.invalid:8001';
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null });
  mockAuth.signOut.mockResolvedValue({ error: null });
  global.fetch = jest.fn(async (url) => ({ ok: true, status: 200, json: async () => String(url).endsWith('/api/profile') ? profile : [] }) as Response);
});

async function signIn() {
  fireEvent.changeText(await screen.findByLabelText('Email'), '  learner@example.invalid  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'fake-password');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Sign in' })); });
}

test('signs in with existing credentials and loads the profile before Today', async () => {
  render(<MobileApp />);
  await signIn();
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
  expect(screen.getByText('Nothing running yet.')).toBeVisible();
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'learner@example.invalid', password: 'fake-password' });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch).toHaveBeenCalledWith('http://api.test.invalid:8001/api/profile', expect.objectContaining({
    method: 'GET', headers: { Authorization: 'Bearer fake-mobile-token' },
  }));
});

test('requires email and password, and keeps the password masked by default', async () => {
  render(<MobileApp />);
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
  render(<MobileApp />); await signIn();
  const busy = screen.getByRole('button', { name: 'Signing in…' });
  expect(busy).toBeDisabled(); fireEvent.press(busy);
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
  release({ data: { session: mockSession }, error: null });
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
});

test('shows a plain wrong-password error and allows another attempt', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { status: 400 } });
  render(<MobileApp />); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Email or password wasn't recognised\./);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
});

test('shows No connection offline and never sends credentials or a profile request', async () => {
  mockNetwork.isConnected = false;
  render(<MobileApp />);
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
  render(<MobileApp />);
  expect(screen.getByText('Opening your rhythm…')).toBeVisible();
  expect(screen.queryByText('Nothing running yet.')).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
  release({ data: { session: mockSession }, error: null });
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

test('shows a profile-shaped loading state until the profile request resolves', async () => {
  let release!: (result: unknown) => void;
  const originalFetch = async () => ({ ok: true, status: 200, json: async () => [] }) as Response;
  (global.fetch as jest.Mock).mockImplementation((...args) => String(args[0]).endsWith('/api/profile') ? new Promise(resolve => { release = resolve; }) : originalFetch());
  mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
  render(<MobileApp />);
  expect(await screen.findByText('Loading your profile…')).toBeVisible();
  expect(screen.queryByText('Nothing running yet.')).toBeNull();
  release({ ok: true, status: 200, json: async () => profile });
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
});

test('a missing profile links to web onboarding without creating an account', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  render(<MobileApp />); await signIn();
  expect(await screen.findByText('Finish setting up on the web')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Set up your rhythm on the web' })).toBeVisible();
  expect(screen.queryByText('Nothing running yet.')).toBeNull();
});

test('retries an unavailable profile without signing in again', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
  render(<MobileApp />); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't load your profile\./);
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Nothing running yet.')).toBeVisible();
  expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
});

test('an expired profile session returns to sign-in with a clear message', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
  render(<MobileApp />); await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Sign in again.');
  expect(screen.getByLabelText('Email')).toBeVisible();
  expect(screen.queryByText('Nothing running yet.')).toBeNull();
});

test('signs out only this device and removes private content', async () => {
  render(<MobileApp />); await signIn();
  await screen.findByText('Nothing running yet.');
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByText('Nothing running yet.')).toBeNull();
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test.each(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])(
  'a blank %s shows its name and never initializes auth', async name => {
    process.env[name] = '   ';
    render(<MobileApp />);
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
  render(<MobileApp />);
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open Rhythm.");
  mockFonts.ready = true; mockFonts.error = null;
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
});
