import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { LAYOUT, MOTION_DURATION_MS, RADII, SPACING } from '@rhythm-health/brand';
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
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const press = (name: string) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });

const SLIDES = ['Stop guessing. Test one habit.', 'See the prediction before day one.', 'Check in each day in about 30 seconds.', 'Compare the prediction with what happened.'];
const FIRST = SLIDES[0];
const motionAllowed = () => jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
const currentDot = () => screen.getAllByRole('button', { name: /^Go to slide/ }).findIndex(dot => dot.props.accessibilityState?.selected);
const wait = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

test('signed out, the app opens on the carousel with no private request', async () => {
  render(<MobileApp />);
  expect(await screen.findByRole('header', { name: FIRST })).toBeVisible();
  expect(screen.getAllByRole('button', { name: /^Go to slide/ })).toHaveLength(SLIDES.length);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('every slide says one short line, in the rules for the product', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  for (const line of SLIDES) {
    expect(line.length).toBeLessThanOrEqual(44);
    expect(line).not.toMatch(/unlock|journey|discover|transform|calorie|weight|cure|diagnos/i);
    expect(screen.getAllByText(line, { includeHiddenElements: true }).length).toBeGreaterThan(0);
  }
  expect(screen.getByText(/A pattern, not proof/, { includeHiddenElements: true })).toBeTruthy();
});

test('the slides advance by themselves and loop', async () => {
  motionAllowed();
  jest.useFakeTimers();
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  expect(currentDot()).toBe(0);
  await wait(MOTION_DURATION_MS.dwell);
  expect(currentDot()).toBe(1);
  await wait(MOTION_DURATION_MS.dwell);
  await wait(MOTION_DURATION_MS.dwell);
  expect(currentDot()).toBe(3);
  await wait(MOTION_DURATION_MS.dwell);
  expect(currentDot()).toBe(0);
});

test('Pause stops the slides and Play starts them again', async () => {
  motionAllowed();
  jest.useFakeTimers();
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  await press('Pause slides');
  await wait(MOTION_DURATION_MS.dwell * 2);
  expect(currentDot()).toBe(0);
  await press('Play slides');
  await wait(MOTION_DURATION_MS.dwell);
  expect(currentDot()).toBe(1);
});

test('a dot goes to its slide', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  await press('Go to slide 3 of 4');
  expect(currentDot()).toBe(2);
  expect(screen.getByRole('header', { name: SLIDES[2] })).toBeVisible();
});

test('holding a slide stops it moving until you let go', async () => {
  motionAllowed();
  jest.useFakeTimers();
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  const pager = screen.getByTestId('landing-slides');
  fireEvent(pager, 'scrollBeginDrag');
  await wait(MOTION_DURATION_MS.dwell * 2);
  expect(currentDot()).toBe(0);
  fireEvent(pager, 'scrollEndDrag');
  await wait(MOTION_DURATION_MS.dwell);
  expect(currentDot()).toBe(1);
});

test('with Reduce Motion on, the slides wait for you', async () => {
  jest.useFakeTimers();
  render(<MobileApp />); // The test double reports Reduce Motion on.
  await screen.findByRole('header', { name: FIRST });
  await wait(MOTION_DURATION_MS.dwell * 2);
  expect(currentDot()).toBe(0);
  expect(screen.queryByRole('button', { name: 'Pause slides' })).toBeNull();
});

test('with a screen reader on, the slides wait for you', async () => {
  motionAllowed();
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  jest.useFakeTimers();
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  await wait(0);
  await wait(MOTION_DURATION_MS.dwell * 2);
  expect(currentDot()).toBe(0);
  expect(screen.queryByRole('button', { name: 'Pause slides' })).toBeNull();
});

test('Sign in under the main action opens the form on sign-in', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  expect(screen.queryByTestId('app-header')).toBeNull();
  await press('Sign in');
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeVisible();
});

test('Start an experiment opens account creation', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  await press('Start an experiment');
  expect(await screen.findByRole('header', { name: 'Create an account.' })).toBeVisible();
});

test('the form can go back to the landing', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  await press('Start an experiment');
  await press('Close');
  expect(await screen.findByRole('header', { name: FIRST })).toBeVisible();
});

test('a signed-in person never sees it', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Ask a question.' });
  expect(screen.queryByRole('header', { name: FIRST })).toBeNull();
});

test('signing out goes to the form rather than the landing', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Ask a question.' });
  await act(async () => { fireEvent.press(screen.getByRole('tab', { name: 'You' })); });
  await press('Sign out');
  expect(await screen.findByLabelText('Email')).toBeVisible();
  expect(screen.queryByRole('header', { name: FIRST })).toBeNull();
});

test('the picture of the app is a real phone frame, labelled as an example, that overlaps the edge of the sky', async () => {
  render(<MobileApp />);
  await screen.findByRole('header', { name: FIRST });
  const frame = StyleSheet.flatten(screen.getAllByTestId('landing-phone', { includeHiddenElements: true })[0].props.style) as { width: number; height: number; borderWidth: number; borderRadius: number };
  expect(frame.borderWidth).toBeGreaterThanOrEqual(SPACING.xs);
  expect(frame.borderRadius).toBeGreaterThanOrEqual(RADII.card);
  expect(frame.height / frame.width).toBeGreaterThan(1.4);
  expect(frame.width).toBeLessThanOrEqual(LAYOUT.buttonMaxWidth);
  const sky = StyleSheet.flatten(screen.getAllByTestId('landing-sky', { includeHiddenElements: true })[0].props.style) as { bottom: number };
  expect(sky.bottom).toBeGreaterThanOrEqual(SPACING.section);
  expect(screen.getAllByText('Example', { includeHiddenElements: true }).length).toBeGreaterThan(0);
});
