import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { MobileApp } from '../src/mobile-app';
import { profile } from '../../../frontend/tests/support/fixtures';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  global.fetch = jest.fn(async url => {
    const path = String(url);
    const body = path.endsWith('/api/profile') ? profile : [];
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());
const press = (name: string) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });

test('signed out, the app opens on the landing with no private request', async () => {
  render(<MobileApp />);
  expect(await screen.findByRole('header', { name: 'How it works' })).toBeVisible();
  expect(screen.getByRole('header', { name: 'A question worth testing.' })).toBeVisible();
  expect(screen.getByRole('header', { name: 'Your first question takes about a minute to set up.' })).toBeVisible();
  expect(screen.getByText('Does walking after dinner improve my sleep?')).toBeVisible();
  expect(screen.getByRole('header', { name: 'The prediction comes first.' })).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the header offers Sign in, which opens the form on sign-in', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'How it works' });
  const header = within(screen.getByTestId('app-header'));
  await act(async () => { fireEvent.press(header.getByRole('button', { name: 'Sign in' })); });
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeVisible();
  expect(within(screen.getByTestId('app-header')).queryByRole('button', { name: 'Sign in' })).toBeNull();
});

test('Run your first experiment opens account creation', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'How it works' });
  await press('Run your first experiment');
  expect(await screen.findByRole('header', { name: 'Create an account.' })).toBeVisible();
});

test('the form can go back to the landing', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'How it works' });
  await press('Run your first experiment');
  await press('Back to rhythm');
  expect(await screen.findByRole('header', { name: 'How it works' })).toBeVisible();
});

test('a signed-in person never sees it', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Ask a question.' });
  expect(screen.queryByRole('header', { name: 'How it works' })).toBeNull();
});

test('signing out goes to the form rather than the landing', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Ask a question.' });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Account menu/ })); });
  await press('Sign out');
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByRole('header', { name: 'How it works' })).toBeNull();
});
