import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, THEMES } from '@rhythm-health/brand';
import { writeDraft } from '../src/lib/onboarding';
import { MobileApp } from '../src/mobile-app';
import { ThemeProvider } from '../src/theme';
import { Copy, StickyAction, useStyles } from '../src/ui';
import { profile, proposeResponse } from '../../../frontend/tests/support/fixtures';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
}, { virtual: true });

const OWNER = 'fake-user';
const session = { access_token: 'fake-token', user: { id: OWNER, email: 'learner@example.invalid' } };
const TABS = ['Today', 'Progress', 'Ask', 'History', 'You'];
const QUESTION = 'Does walking after dinner help my mornings?';
const answers = { age_range: '25-34', usual_sleep_schedule: { bedtime: '23:30', wake_time: '07:00' }, usual_sleep_hours: 7, activity_level: 'lightly_active', goals: ['Better focus'], regular_habits: [], constraints: [] } as const;
let routes: Record<string, { status?: number; body: unknown }>;
let keyboard: Record<string, () => void>;

beforeEach(() => {
  jest.clearAllMocks();
  keyboard = {};
  routes = {
    'GET /api/profile': { body: profile },
    'GET /api/experiments?status=active': { body: [] },
    'GET /api/experiments?status=completed': { body: [] },
    'POST /api/experiments/propose': { body: { ...proposeResponse, personal_guess_available: false } },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: () => void) => {
    keyboard[event] = handler;
    return { remove: () => undefined };
  }) as never);
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    const reply = routes[key];
    if (!reply) throw new Error(`Unexpected fake request: ${key}`);
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const signedIn = async () => { render(<MobileApp />); await screen.findByRole('header', { name: 'Ask a question.' }); };
const tab = (name: string) => screen.getByRole('tab', { name });
const pressTab = (name: string) => act(async () => { fireEvent.press(tab(name)); });
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
/** Setup at one step, restored from the device draft, so no test walks the whole flow. */
async function setupAt(step: number, draft: object = answers) {
  routes['GET /api/profile'] = { status: 404, body: {} };
  await writeDraft(OWNER, { draft, step, editing: false } as never);
  render(<MobileApp />);
}
async function openPlan() {
  await signedIn();
  fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design experiment' })); });
  await screen.findByRole('button', { name: 'Start this experiment' });
}

describe('the tab bar', () => {
  test('has five named tabs, with Today selected and at least 48pt each', async () => {
    await signedIn();
    for (const name of TABS) expect(flat(tab(name)).minHeight).toBeGreaterThanOrEqual(LAYOUT.primaryAction);
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'History', selected: false })).toBeVisible();
    expect(within(screen.UNSAFE_getByType(ScrollView)).queryByRole('tab', { name: 'Today' })).toBeNull();
  });

  test('You holds the account, the theme and sign out; the header no longer does', async () => {
    await signedIn();
    expect(screen.queryByRole('button', { name: /^Account menu/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    await pressTab('You');
    for (const name of ['Update your rhythm', 'Daily reminders', 'See an example', 'Sign out']) expect(screen.getByRole('button', { name })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeVisible();
    expect(screen.getByText('learner@example.invalid')).toBeVisible();
  });

  test('Progress is a tab, with an honest empty state when nothing has started', async () => {
    await signedIn();
    await pressTab('Progress');
    expect(await screen.findByRole('header', { name: 'Progress' })).toBeVisible();
    expect(screen.getByText('Nothing running yet.')).toBeVisible();
  });

  test('empty Progress offers the next step', async () => {
    await signedIn();
    await pressTab('Progress');
    await screen.findByText('Nothing running yet.');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Ask a question' })); });
    expect(await screen.findByLabelText('Your question or goal')).toBeVisible();
  });

  test('a new person sees the example and still gets the next step', async () => {
    routes['GET /api/experiments/progress-summary'] = { body: { metrics: [], kept: [], example: { question: 'Sample question?', metrics: [] } } };
    await signedIn();
    await pressTab('Progress');
    await screen.findByTestId('progress-example');
    expect(screen.getByText('Nothing running yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ask a question' })).toBeVisible();
  });

  test('someone with finished experiments is not told it is their first time', async () => {
    routes['GET /api/experiments/progress-summary'] = { body: { metrics: [{ key: 'energy', label: 'Energy', type: 'scale', runs: [], normal_change: null }], kept: [], example: null } };
    await signedIn();
    await pressTab('Progress');
    expect(await screen.findByText('Nothing running right now.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ask a question' })).toBeVisible();
  });

  test('is hidden in a flow, and hidden while the keyboard is up', async () => {
    await signedIn();
    expect(tab('Today')).toBeVisible();
    act(() => { keyboard[Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'](); });
    expect(screen.queryByRole('tab', { name: 'Today' })).toBeNull();
    act(() => { keyboard[Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'](); });
    expect(tab('Today')).toBeVisible();
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design experiment' })); });
    await screen.findByRole('button', { name: 'Start this experiment' });
    expect(screen.queryByRole('tab', { name: 'Today' })).toBeNull();
  });

  test('moving between tabs keeps a paid plan, and Ask brings it back', async () => {
    await openPlan();
    await act(async () => { fireEvent.press(screen.getByRole('link', { name: 'Rhythm, home' })); });
    expect(await screen.findByRole('button', { name: 'Start this experiment' })).toBeVisible();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/propose'))).toHaveLength(1);
  });
});

describe('the primary action', () => {
  test('sits outside the scroller, inside one KeyboardAvoidingView with it', async () => {
    await setupAt(1, {});
    const button = await screen.findByRole('button', { name: 'Continue' });
    expect(within(screen.UNSAFE_getByType(ScrollView)).queryByRole('button', { name: 'Continue' })).toBeNull();
    const avoiding = within(screen.UNSAFE_getByType(KeyboardAvoidingView));
    expect(avoiding.getByRole('button', { name: 'Continue' })).toBe(button);
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).findByType(ScrollView)).toBeTruthy();
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  test('stays on screen when the keyboard opens on Ask, while the tabs step aside', async () => {
    await signedIn();
    act(() => { keyboard.keyboardWillShow(); });
    expect(screen.getByRole('button', { name: 'Design experiment' })).toBeVisible();
    expect(within(screen.UNSAFE_getByType(ScrollView)).queryByRole('button', { name: 'Design experiment' })).toBeNull();
  });

  test('a screen rendered without a frame still shows its action', () => {
    render(<StickyAction><Copy>Save</Copy></StickyAction>);
    expect(screen.getByText('Save')).toBeVisible();
  });

  test.each(['light', 'dark'] as const)('disabled, it is a visible shape with readable words in %s', mode => {
    const { disabled } = useStyles.forMode(mode);
    expect(disabled.backgroundColor).toBe(THEMES[mode]['accent-tint']);
    expect(disabled.borderWidth ?? 0).toBe(0);
  });

  test('disabled, it says what unlocks it', async () => {
    await setupAt(1, {});
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByText('Pick one to continue.')).toBeVisible();
    fireEvent.press(screen.getByRole('radio', { name: '25–34' }));
    expect(screen.queryByText('Pick one to continue.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});

describe('setup', () => {
  test('has no big Sign out in the flow; it stays in the menu', async () => {
    await setupAt(1, {});
    await screen.findByRole('button', { name: 'Continue' });
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /^Account menu/ })); });
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('says nothing about the times until both are set', async () => {
    await setupAt(2, {});
    await screen.findByRole('button', { name: 'Bedtime' });
    expect(screen.queryByText('Enter both times.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Pick both times to continue.')).toBeVisible();
  });

  test('an empty time row reads as a form row, not green monospace', async () => {
    await setupAt(2, {});
    const row = await screen.findByRole('button', { name: 'Bedtime' });
    expect(within(row).queryByText('Choose a time')).toBeNull();
    const value = within(row).getAllByText('Choose')[0];
    expect(flat(value).color).toBe(THEMES.light.muted);
    expect(flat(value).color).not.toBe(THEMES.light.accent);
  });

  test('hours asleep is one adjustable value with two 48pt buttons', async () => {
    await setupAt(3);
    const stepper = await screen.findByRole('adjustable', { name: 'Hours asleep' });
    expect(stepper.props.accessibilityValue).toMatchObject({ text: '7 hours' });
    for (const name of ['Half an hour less', 'Half an hour more']) {
      expect(flat(screen.getByRole('button', { name })).minHeight).toBeGreaterThanOrEqual(LAYOUT.primaryAction);
      expect(screen.queryByText(name)).toBeNull();
    }
    await act(async () => { fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }); });
    expect(screen.getByText('6.5')).toBeVisible();
  });

  test('review is rows with a label and value, not Change buttons', async () => {
    await setupAt(8);
    await screen.findByText("Here's your rhythm.");
    expect(screen.queryByRole('button', { name: 'Change goals' })).toBeNull();
    const goals = screen.getByRole('button', { name: 'Goals: Better focus' });
    expect(goals.props.accessibilityHint).toBe('Change');
    for (const name of [/^Sleep:/, /^Hours asleep:/, /^Activity:/, /^Habits:/, /^Limits:/, /^Age:/]) expect(screen.getByRole('button', { name })).toBeVisible();
    fireEvent.press(goals);
    expect(screen.getByRole('checkbox', { name: 'Better focus' })).toBeChecked();
  });

  test('the step label is one line of text that can wrap', async () => {
    await setupAt(2, {});
    expect(await screen.findByText('2 of 7 · Sleep')).toBeVisible();
  });

  test('the time picker follows the dark theme', async () => {
    routes['GET /api/profile'] = { status: 404, body: {} };
    await writeDraft(OWNER, { draft: {}, step: 2, editing: false } as never);
    jest.requireMock('expo-secure-store').getItemAsync.mockImplementationOnce(async () => 'dark');
    render(<ThemeProvider><MobileApp /></ThemeProvider>);
    fireEvent.press(await screen.findByRole('button', { name: 'Bedtime' }));
    expect(screen.getByLabelText('Time picker').props.themeVariant).toBe('dark');
  });
});

describe('reading order', () => {
  test.each(['light', 'dark'] as const)('body text cannot shrink out of sight, and numbers are not links, in %s', mode => {
    const { body, number, title } = useStyles.forMode(mode);
    expect(body).not.toHaveProperty('flexShrink');
    expect(number.color).toBe(THEMES[mode].text);
    expect(title.fontSize).toBe(NATIVE_TYPOGRAPHY.headline.fontSize);
  });

  test('Ask is a heading, one line and quiet suggestions', async () => {
    await signedIn();
    expect(screen.getByText('What do you want to test?')).toBeVisible();
    expect(screen.queryByText('A little curiosity, a little evidence')).toBeNull();
    const starter = screen.getByRole('button', { name: 'Does less caffeine improve my focus?' });
    expect(flat(starter).backgroundColor).not.toBe(THEMES.light['accent-tint']);
    expect(flat(starter).borderColor).toBe(THEMES.light.control);
    expect(flat(starter).maxWidth).toBe('100%');
  });

  test('waiting is a designed moment with one honest line', async () => {
    await signedIn();
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design experiment' })); });
    expect(screen.getByText('Usually 10–30 seconds.')).toBeVisible();
    expect(screen.queryByText('A suitable question')).toBeNull();
  });

  test('the guess is one line, with the detail behind Why?', async () => {
    routes['POST /api/experiments/propose'] = { body: { ...proposeResponse, personal_guess_available: true } };
    await signedIn();
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), QUESTION);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design experiment' })); });
    expect(await screen.findByText('Change from your normal days. +10 means 10% higher.')).toBeVisible();
    expect(screen.queryByText(/Your guess locks/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText(/It locks when you see the prediction/)).toBeVisible();
  });

  test('the plan leads with the change, the days and the range; the reasons wait behind Why?', async () => {
    await openPlan();
    const { proposal, prediction } = proposeResponse;
    expect(screen.getByText(proposal!.intervention.action)).toBeVisible();
    expect(screen.getByText(`${proposal!.baseline_days} normal days, then ${proposal!.intervention_days} test days`)).toBeVisible();
    expect(screen.getByText(/^Confidence:/)).toBeVisible();
    expect(screen.getByText('Fixed once you start.')).toBeVisible();
    expect(screen.queryByText(proposal!.hypothesis)).toBeNull();
    expect(screen.queryByText(prediction!.reasoning)).toBeNull();
    const why = screen.getByRole('button', { name: 'Why?' });
    expect(why.props.accessibilityState).toMatchObject({ expanded: false });
    fireEvent.press(why);
    expect(screen.getByText(proposal!.hypothesis)).toBeVisible();
    expect(screen.getByText(prediction!.reasoning)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Why?' }).props.accessibilityState).toMatchObject({ expanded: true });
  });
});
