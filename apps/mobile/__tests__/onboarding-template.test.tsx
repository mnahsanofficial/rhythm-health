import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { writeDraft } from '../src/lib/onboarding';
import { arcFraction, habitIcon, goalIcon, marker, RING_LENGTH, sceneHeight, stepDirection } from '../src/lib/scene';
import { MobileApp } from '../src/mobile-app';
import { profile } from '../../../frontend/tests/support/fixtures';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
}, { virtual: true });

const OWNER = 'fake-user';
const session = { access_token: 'fake-token', user: { id: OWNER, email: 'learner@example.invalid' } };
const answers = { age_range: '25-34', usual_sleep_schedule: { bedtime: '23:00', wake_time: '07:00' }, usual_sleep_hours: 7, activity_level: 'lightly_active', goals: ['Better focus'], regular_habits: [], constraints: [] };
const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  global.fetch = jest.fn(async (url) => ({ ok: !String(url).endsWith('/api/profile'), status: String(url).endsWith('/api/profile') ? 404 : 200, json: async () => (String(url).endsWith('/api/profile') ? {} : profile) }) as Response);
});
afterEach(() => jest.restoreAllMocks());

async function at(step: number, draft: object = answers) {
  await writeDraft(OWNER, { draft, step, editing: false } as never);
  render(<MobileApp />);
  await screen.findByTestId('onboarding-scene', hidden);
}

describe('the template', () => {
  test.each([1, 2, 3, 4, 5, 6, 7])('step %s has the bar, the scene, and the question below them, outside the scroller', async step => {
    await at(step);
    const scroller = within(screen.UNSAFE_getByType(ScrollView));
    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toBeVisible();
    expect(scroller.queryByRole('progressbar', { name: 'Setup progress' })).toBeNull();
    expect(scroller.queryByTestId('onboarding-scene', hidden)).toBeNull();
    expect(scroller.getByRole('header')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('the bar says where you are, in short words', async () => {
    await at(2);
    expect(screen.getByText('2 of 7 · Sleep')).toBeVisible();
  });

  test('the scene is decoration: hidden from screen readers', async () => {
    await at(1);
    expect(screen.queryByTestId('onboarding-scene')).toBeNull();
    expect(screen.getByTestId('onboarding-scene', hidden).props.accessibilityElementsHidden).toBe(true);
  });

  test('every step says Continue, also while editing, and only review saves', async () => {
    await writeDraft(OWNER, { draft: answers, step: 6, editing: true } as never);
    render(<MobileApp />);
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save my rhythm' })).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
    expect(await screen.findByRole('button', { name: 'Save my rhythm' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  test('nothing is a separate rhythm ring any more, and midnight is labelled on the ring', async () => {
    await at(2);
    expect(screen.queryByRole('button', { name: 'Your rhythm so far' })).toBeNull();
    screen.unmount();
    await at(8);
    expect(screen.queryByText('Midnight at the top')).toBeNull();
    for (const label of ['12am', '6am', '12pm', '6pm']) expect(screen.getByText(label, hidden)).toBeTruthy();
  });

  test('a choice gives a light haptic', async () => {
    await at(1, {});
    fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  test('sleep has one line under the question, whichever times are set', async () => {
    await at(2);
    expect(screen.getByText("That's 8 h in bed.")).toBeVisible();
    expect(screen.queryByText('On a normal workday. Rough is fine.')).toBeNull();
    screen.unmount();
    await at(2, {});
    expect(screen.getByText('On a normal workday. Rough is fine.')).toBeVisible();
  });
});

describe('scroll padding', () => {
  test('equals the sticky bar height, so nothing is ever hidden behind it', async () => {
    await at(8);
    const bar = screen.getByTestId('sticky-footer');
    act(() => { fireEvent(bar, 'layout', { nativeEvent: { layout: { x: 0, y: 700, width: 390, height: 137 } } }); });
    const padding = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).paddingBottom;
    expect(padding).toBe(137);
    expect(StyleSheet.flatten(bar.props.style).position).toBe('absolute');
  });

  test('with no sticky bar there is no extra padding', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url) => ({ ok: true, status: 200, json: async () => (String(url).endsWith('/api/profile') ? profile : []) }) as Response);
    jest.requireActual('./support/notifications').preferences.set('rhythm-first-run', 'seen');
    render(<MobileApp />);
    const you = await screen.findByRole('tab', { name: 'You' });
    await act(async () => { fireEvent.press(you); });
    expect(screen.queryByTestId('sticky-footer')).toBeNull();
  });
});

describe('the scene reacts to the answers', () => {
  const length = (testID: string) => RING_LENGTH - screen.UNSAFE_getAllByProps({ testID })[0].props.strokeDashoffset;
  const cx = (testID: string) => screen.UNSAFE_getAllByProps({ testID })[0].props.cx;

  test('the sleep arc and markers follow the times', async () => {
    await at(2);
    expect(length('scene-arc')).toBeCloseTo(arcFraction(8 * 60) * RING_LENGTH, 1);
    expect(cx('scene-moon')).toBeCloseTo(marker(23 * 60).x, 1);
    expect(cx('scene-sun')).toBeCloseTo(marker(7 * 60).x, 1);
  });

  test('hours asleep fills inside the time in bed, and moves with − and +', async () => {
    await at(3);
    const before = length('scene-asleep');
    expect(before).toBeCloseTo(arcFraction(7 * 60) * RING_LENGTH, 1);
    expect(before).toBeLessThan(length('scene-arc'));
    fireEvent.press(screen.getByRole('button', { name: 'Half an hour less' }));
    expect(length('scene-asleep')).toBeLessThan(before);
  });

  test('the walking figure goes further for each activity level', async () => {
    await at(4, { ...answers, activity_level: undefined });
    const steps = () => screen.UNSAFE_queryAllByProps({ testID: 'scene-footprint' }).length;
    const none = steps();
    fireEvent.press(screen.getByRole('radio', { name: /^Mostly sitting/ }));
    const sitting = steps();
    fireEvent.press(screen.getByRole('radio', { name: /^Very active/ }));
    expect(sitting).toBeGreaterThanOrEqual(none);
    expect(steps()).toBeGreaterThan(sitting);
  });

  test('picked goals appear in the scene', async () => {
    await at(5, { ...answers, goals: [] });
    expect(screen.queryAllByTestId('scene-picked', hidden)).toHaveLength(0);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Better focus' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Fall asleep faster' }));
    expect(screen.getAllByTestId('scene-picked', hidden)).toHaveLength(2);
  });

  test('habits work the same way', async () => {
    await at(6);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Coffee around 9am' }));
    expect(screen.getAllByTestId('scene-picked', hidden)).toHaveLength(1);
  });
});

describe('the sums behind the scene', () => {
  test('the ring puts midnight at the top and noon at the bottom', () => {
    expect(marker(0).x).toBeCloseTo(195); expect(marker(0).y).toBeLessThan(130);
    expect(marker(12 * 60).x).toBeCloseTo(195); expect(marker(12 * 60).y).toBeGreaterThan(130);
    expect(marker(6 * 60).x).toBeGreaterThan(195);
  });
  test('an arc is its share of a day, and never over a full one', () => {
    expect(arcFraction(720)).toBeCloseTo(0.5);
    expect(arcFraction(5000)).toBe(1);
    expect(arcFraction(-5)).toBe(0);
  });
  test('forward slides in from the right, back from the left', () => {
    expect(stepDirection(2, 3)).toBe(1);
    expect(stepDirection(3, 2)).toBe(-1);
    expect(stepDirection(3, 3)).toBe(0);
  });
  test('every listed goal and habit has an icon, and an unknown one still gets one', () => {
    expect(goalIcon('Better focus')).toBe('focus');
    expect(goalIcon('Fall asleep faster')).toBe('sleep');
    expect(goalIcon('Eat more vegetables')).toBe('greens');
    expect(goalIcon('Something I typed')).toBe('spark');
    expect(habitIcon('Coffee after 2pm')).toBe('coffee');
    expect(habitIcon('Walk after dinner')).toBe('walk');
    expect(habitIcon('Tea before bed')).toBe('spark');
  });
  test.each([[844, 8, 0.2], [844, 2, 0.3], [667, 2, 0.24], [844, 7, 0.26]])('at height %s, step %s, the scene takes about %s of the screen', (height, step, share) => {
    expect(sceneHeight(height, step) / height).toBeCloseTo(share, 1);
  });
  test('the review ring is never more than a third of the screen', () => {
    for (const height of [568, 667, 844, 932]) expect(sceneHeight(height, 8)).toBeLessThanOrEqual(height / 3);
  });
});
