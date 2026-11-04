import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, StyleSheet, TextInput } from 'react-native';
import { COLORS, LAYOUT } from '@rhythm-health/brand';
import type { Experiment } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { goTo } from './support/nav';
import { completedExperiment, experiment, labReport, profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
}, { virtual: true });

const ACTIVE = '/api/experiments?status=active';
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const running: Experiment = { ...experiment, status: 'active', progress: {
  ...experiment.progress, state: 'in_progress', day_number: 4, phase: 'intervention', phase_day: 1, phase_days: 7, days_remaining: 6, started_at: '2026-11-01T09:00:00Z',
} };
const ended: Experiment = { ...running, progress: { ...running.progress, state: 'ended', day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0 } };

type Reply = { status?: number; body?: unknown };
let routes: Record<string, Reply>;
beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  routes = {
    'GET /api/profile': { body: profile },
    [`GET ${ACTIVE}`]: { body: [] },
    'GET /api/experiments?status=completed': { body: [completedExperiment] },
    [`GET /api/experiments/${completedExperiment.id}/report`]: { body: labReport },
    [`GET /api/experiments/${experiment.id}/checkins`]: { body: [] },
    'POST /api/experiments/propose': { body: { ...proposeResponse, personal_guess_available: true } },
    [`POST /api/experiments/${experiment.id}/complete`]: { body: labReport },
    [`POST /api/experiments/${experiment.id}/report`]: { body: writtenLabReport },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  global.fetch = jest.fn(async (url, options) => {
    const key = `${options?.method ?? 'GET'} ${String(url).replace('http://api.test.invalid:8001', '')}`;
    const reply = routes[key];
    if (!reply) throw new Error(`Unexpected fake request: ${key}`);
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

function setActive(current: Experiment, recorded: number[] = []) {
  routes[`GET ${ACTIVE}`] = { body: [current] };
  routes[`GET /api/experiments/${current.id}/progress`] = { body: timelineFixture(current, { recorded }) };
}
const styleOf = (style: unknown) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) as { minHeight?: number };

/** Every control on the current screen has a spoken name and a 48pt target. */
function auditControls() {
  const problems: string[] = [];
  const touchable = screen.UNSAFE_root.findAll(node => typeof node.type === 'string' && typeof node.props.onClick === 'function' && node.props.accessible !== false);
  expect(touchable.length).toBeGreaterThan(0);
  for (const { props } of touchable) {
    const name = props.accessibilityLabel ?? '(no name)';
    if (!props.accessibilityLabel) problems.push(`no name: ${props.accessibilityRole}`);
    if (!props.accessibilityRole) problems.push(`no role: ${name}`);
    if ((styleOf(props.style).minHeight ?? 0) < LAYOUT.primaryAction) problems.push(`under 48pt: ${name}`);
  }
  for (const { props } of screen.UNSAFE_queryAllByType(TextInput)) {
    if (!props.accessibilityLabel) problems.push('input with no name');
    if ((styleOf(props.style).minHeight ?? 0) < LAYOUT.primaryAction) problems.push(`input under 48pt: ${props.accessibilityLabel}`);
  }
  expect(problems).toEqual([]);
}
const press = (name: string | RegExp) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });

describe('controls have names and 48pt targets', () => {
  test('sign in', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Stop guessing. Test one habit.' });
    auditControls();
    await press('Sign in');
    await screen.findByLabelText('Email');
    auditControls();
  });

  test('onboarding', async () => {
    routes['GET /api/profile'] = { status: 404, body: {} };
    render(<MobileApp />);
    const start = await screen.findByRole('button', { name: 'Start' });
    auditControls();
    await act(async () => { fireEvent.press(start); });
    await screen.findByRole('header', { name: 'How old are you?' });
    auditControls();
  });

  test('Today, Settings and History', async () => {
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Ask a question.' });
    auditControls();
    await goTo('Daily reminders');
    auditControls();
    await goTo('History');
    await screen.findByRole('button', { name: `Open Lab Report for ${completedExperiment.question}` });
    auditControls();
  });

  test('check-in and progress', async () => {
    setActive(running, [1, 2, 3]);
    render(<MobileApp />);
    const start = await screen.findByRole('button', { name: 'Check in now, day 4' });
    await act(async () => { fireEvent.press(start); });
    await screen.findByLabelText('Optional note');
    auditControls();
    await press('Close');
    await act(async () => { fireEvent.press(await screen.findByRole('tab', { name: 'Progress' })); });
    await screen.findByText('Day by day');
    auditControls();
  });

  test('question, guess and plan', async () => {
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Ask a question.' });
    auditControls();
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), 'Does walking after dinner help my mornings?');
    await press('Design experiment');
    const guess = await screen.findByLabelText('Your guess for Morning energy');
    auditControls();
    fireEvent.changeText(guess, '10');
    await press('Show prediction');
    await screen.findByRole('button', { name: 'Start this experiment' });
    auditControls();
  });

  test('Lab Report, with the chart columns left out of the accessibility tree', async () => {
    setActive(ended);
    render(<MobileApp />);
    const finish = await screen.findByRole('button', { name: 'See your results' });
    await act(async () => { fireEvent.press(finish); });
    const report = await screen.findByRole('button', { name: 'See full Lab Report' });
    await act(async () => { fireEvent.press(report); });
    await screen.findByRole('button', { name: 'Compare with the prediction' });
    await press('Compare with the prediction');
    auditControls();
  });
});

describe('screen readers hear what changes', () => {
  test('errors are announced on iOS', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    routes['POST /api/experiments/propose'] = { status: 503, body: { detail: 'AI service unavailable' } };
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Ask a question.' });
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), 'Does walking after dinner help my mornings?');
    await press('Design experiment');
    await screen.findByText(/The service is unavailable right now\./);
    expect(announce).toHaveBeenCalledWith('The service is unavailable right now. AI service unavailable');
  });

  test('progress messages are announced on iOS', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    render(<MobileApp />);
    await screen.findByRole('header', { name: 'Ask a question.' });
    let release!: (reply: Response) => void;
    const fake = global.fetch as jest.Mock; const original = fake.getMockImplementation()!;
    fake.mockImplementation((url, options) => String(url).endsWith('/propose')
      ? new Promise<Response>(resolve => { release = resolve; }) : original(url, options));
    fireEvent.changeText(screen.getByLabelText('Your question or goal'), 'Does walking after dinner help my mornings?');
    await press('Design experiment');
    await screen.findByText('Usually 10–30 seconds.');
    expect(announce).toHaveBeenCalledWith('Usually 10–30 seconds.');
    await act(async () => { release({ ok: true, status: 200, json: async () => routes['POST /api/experiments/propose'].body } as Response); });
  });

  test('the revealed result is announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    setActive(ended);
    render(<MobileApp />);
    const finish = await screen.findByRole('button', { name: 'See your results' });
    await act(async () => { fireEvent.press(finish); });
    const report = await screen.findByRole('button', { name: 'See full Lab Report' });
    await act(async () => { fireEvent.press(report); });
    await press('Compare with the prediction');
    expect(announce).toHaveBeenCalledWith('Your result, +21%, landed outside the predicted range.');
  });

  test('the current section is marked as selected', async () => {
    render(<MobileApp />);
    expect(await screen.findByRole('tab', { name: 'Today', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'History', selected: false })).toBeVisible();
  });
});

describe('colour', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  test.each<[keyof typeof COLORS, keyof typeof COLORS]>([
    ['ink', 'oat'], ['ink', 'paper'], ['ink', 'line'], ['muted', 'oat'], ['muted', 'paper'], ['muted', 'moss-tint'], ['muted', 'night-tint'],
    ['moss', 'oat'], ['moss', 'paper'], ['moss', 'moss-tint'], ['paper', 'moss'], ['night', 'oat'], ['night', 'paper'], ['night', 'night-tint'], ['clay', 'clay-tint'], ['clay', 'oat'],
  ])('%s text on %s meets AA', (text, background) => {
    expect(ratio(COLORS[text], COLORS[background])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('app icon and splash', () => {
  const root = join(__dirname, '..');
  const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const png = (path: string) => {
    const data = readFileSync(join(root, path));
    return { signature: data.subarray(1, 4).toString(), width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
  };
  const splash = () => config.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];

  test('the iOS icon is a 1024px square with no transparency', () => {
    expect(png(config.icon)).toEqual({ signature: 'PNG', width: 1024, height: 1024, colorType: 2 });
  });
  test('the Android adaptive icon is on the brand background', () => {
    expect(png(config.android.adaptiveIcon.foregroundImage)).toMatchObject({ signature: 'PNG', width: 1024, height: 1024 });
    expect(config.android.adaptiveIcon.backgroundColor).toBe(COLORS.oat);
  });
  test('the splash uses the brand background and a valid image', () => {
    expect(splash().backgroundColor).toBe(COLORS.oat);
    expect(png(splash().image)).toMatchObject({ signature: 'PNG', width: 1024, height: 1024 });
    expect(splash().imageWidth).toBeGreaterThan(0);
  });
});
