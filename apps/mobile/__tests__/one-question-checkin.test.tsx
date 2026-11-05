import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { LAYOUT } from '@rhythm-health/brand';
import type { Experiment } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ID = experiment.id;
const day = (number: number, phase: 'baseline' | 'intervention', metrics: Experiment['metrics'] = experiment.metrics): Experiment => ({
  ...experiment, status: 'active', metrics,
  progress: { ...experiment.progress, state: 'in_progress', day_number: number, phase, phase_day: phase === 'baseline' ? number : number - 3, phase_days: phase === 'baseline' ? 3 : 7, total_days: 10, days_remaining: 10 - number, started_at: '2026-10-01T09:00:00Z' },
});
let routes: Record<string, unknown>;
let posted: unknown[];

function install(current: Experiment, checkins: unknown[] = []) {
  routes = {
    'GET /api/profile': profile, 'GET /api/experiments?status=active': [current],
    [`GET /api/experiments/${ID}/progress`]: timelineFixture(current, { nextDayAt: '2026-11-07T18:00:00Z' }),
    [`GET /api/experiments/${ID}/checkins`]: checkins,
    [`POST /api/experiments/${ID}/checkins`]: { id: 'saved' },
  };
}
beforeEach(() => {
  posted = [];
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake', user: { id: 'u', email: 'a@example.invalid' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  global.fetch = jest.fn(async (url, options) => {
    const parsed = new URL(String(url)); const method = options?.method ?? 'GET';
    if (method === 'POST') posted.push(JSON.parse(String(options?.body)));
    const body = routes[`${method} ${parsed.pathname}${parsed.search}`] ?? routes[`${method} ${parsed.pathname}`];
    if (body === undefined) throw new Error(`Unexpected fake request ${method} ${parsed.pathname}`);
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

async function open(number: number) {
  render(<MobileApp />);
  const start = await screen.findByRole('button', { name: `Check in now, day ${number}` });
  await act(async () => { fireEvent.press(start); });
  await screen.findByTestId('checkin-step');
}
const heading = (name: string) => screen.getByRole('header', { name });
const tap = (name: string) => act(async () => { fireEvent.press(screen.getByRole('radio', { name })); });

describe('one question per screen', () => {
  test('a test day asks about the change first, alone, with Yes and Not today', async () => {
    install(day(4, 'intervention')); await open(4);
    expect(heading('Did you make the change?')).toBeVisible();
    expect(screen.getByText(experiment.intervention.action)).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Yes, I made the change' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Not today' })).toBeVisible();
    expect(screen.queryByRole('radio', { name: 'Morning energy: 7' })).toBeNull();
  });

  test('a baseline day has no change step and starts with the main measure', async () => {
    install(day(1, 'baseline')); await open(1);
    expect(heading('Morning energy')).toBeVisible();
    expect(screen.queryByText('Did you make the change?')).toBeNull();
    expect(screen.getByText('Day 1 · Normal day')).toBeVisible();
  });

  test('a tap answers and moves on; Back returns with the answer kept', async () => {
    install(day(4, 'intervention')); await open(4);
    await tap('Not today');
    expect(heading('Morning energy')).toBeVisible();
    await tap('Morning energy: 7');
    expect(heading('Sleep quality')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Back' })); });
    expect(heading('Morning energy')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Morning energy: 7' })).toBeChecked();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Back' })); });
    expect(screen.getByRole('radio', { name: 'Not today' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  test('each step says where it is, by dots and to a screen reader', async () => {
    install(day(4, 'intervention')); await open(4);
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 4' })).toBeVisible();
    expect(screen.getAllByTestId('checkin-dot')).toHaveLength(4);
    await tap('Not today');
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 4' })).toBeVisible();
  });

  test('scale buttons are bigger than the minimum tap target', async () => {
    install(day(1, 'baseline')); await open(1);
    const radio = screen.getByRole('radio', { name: 'Morning energy: 7' });
    expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThan(LAYOUT.primaryAction);
  });

  test('a typed number waits for Next, and Next waits for a valid number', async () => {
    const breaks: Experiment['metrics'][number] = { key: 'breaks', label: 'Breaks', type: 'number', min: null, max: null, min_label: null, max_label: null, short_label: null, unit: null, primary: true };
    install(day(1, 'baseline', [breaks, { ...experiment.metrics[1], primary: false }])); await open(1);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Breaks'), 'lots');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Breaks'), '3');
    expect(heading('Breaks')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
    expect(heading('Sleep quality')).toBeVisible();
  });
});

describe('the review', () => {
  const finish = async () => { await tap('Yes, I made the change'); await tap('Morning energy: 7'); await tap('Sleep quality: 6'); };

  test('shows answers as values, and a tap on one goes back to it', async () => {
    install(day(4, 'intervention')); await open(4); await finish();
    expect(heading('Review')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change Morning energy, 7' })).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Change Sleep quality, 6' })); });
    expect(heading('Sleep quality')).toBeVisible();
    await tap('Sleep quality: 8');
    expect(heading('Sleep quality')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
    expect(screen.getByRole('button', { name: 'Change Sleep quality, 8' })).toBeVisible();
  });

  test('the note stays behind a tap, and is saved', async () => {
    install(day(4, 'intervention')); await open(4); await finish();
    expect(screen.queryByLabelText('Optional note')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Add a note' })); });
    fireEvent.changeText(screen.getByLabelText('Optional note'), ' Late night ');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save check-in' })); });
    await waitFor(() => expect(posted).toEqual([{ intervention_completed: true, metric_values: { morning_energy: 7, sleep_quality: 6 }, note: 'Late night' }]));
  });
});

describe('editing', () => {
  const saved = { id: 'c', experiment_id: ID, day_number: 4, phase: 'intervention', intervention_completed: false, metric_values: { morning_energy: 5, sleep_quality: 6 }, note: 'Earlier', created_at: '2026-10-31T10:00:00Z', updated_at: '2026-10-31T10:00:00Z' };

  test('uses the same flow, prefilled, and Next skips without changing an answer', async () => {
    const current = day(4, 'intervention'); install(current, [saved]);
    routes[`GET /api/experiments/${ID}/progress`] = timelineFixture(current, { recorded: [4], nextDayAt: '2026-11-07T18:00:00Z' });
    render(<MobileApp />);
    const edit = await screen.findByRole('button', { name: "Edit today's answers" });
    await act(async () => { fireEvent.press(edit); });
    await screen.findByTestId('checkin-step');
    expect(screen.getByRole('radio', { name: 'Not today' })).toBeChecked();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
    expect(screen.getByRole('radio', { name: 'Morning energy: 5' })).toBeChecked();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
    expect(heading('Review')).toBeVisible();
    expect(screen.getByLabelText('Optional note')).toHaveDisplayValue('Earlier');
    expect(screen.getByText("Replaces today's answers.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update check-in' })).toBeVisible();
  });
});

describe('motion', () => {
  const offset = () => StyleSheet.flatten(screen.getByTestId('checkin-step').props.style).transform;

  test('Reduce Motion doesn\'t slide', async () => {
    install(day(1, 'baseline')); await open(1);
    expect(offset()).toEqual([{ translateX: 0 }]);
  });

  test('otherwise a step starts to the side of where it lands', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
    const set = jest.spyOn(Reanimated, 'withTiming');
    install(day(1, 'baseline')); await open(1);
    await tap('Morning energy: 7');
    expect(set).toHaveBeenCalledWith(0, expect.anything());
  });
});
