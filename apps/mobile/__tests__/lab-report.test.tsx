import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, AppState, type AppStateStatus } from 'react-native';
import { Polyline } from 'react-native-svg';
import type { Experiment, LabReport, SignalClass, SignalReason } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, labReport, profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ID = experiment.id;
const ACTIVE = '/api/experiments?status=active';
const CAPACITY = 'GET /api/experiments/capacity';
const COMPLETE = `POST /api/experiments/${ID}/complete`;
const READ = `GET /api/experiments/${ID}/report`;
const WRITE = `POST /api/experiments/${ID}/report`;
const PROPOSE = 'POST /api/experiments/propose';
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };

const withProgress = (state: Experiment['progress']['state'], extra: Partial<Experiment['progress']> = {}): Experiment => ({
  ...experiment, status: 'active', progress: { ...experiment.progress, state, day_number: null, phase: null, phase_day: null, phase_days: null, days_remaining: 0, started_at: '2026-10-01T09:00:00Z', ...extra },
});
const ended = withProgress('ended');
const inProgress = withProgress('in_progress', { day_number: 8, phase: 'intervention', phase_day: 5, phase_days: 7, days_remaining: 2 });
const guess = { guessed_change_percent: 12.5, observed_change_percent: 20.5, error_points: 8 };
const guessed = (report: LabReport): LabReport => ({ ...report, analysis: { ...report.analysis, personal_guess: guess } });

type Reply = { status?: number; body?: unknown; network?: boolean };
let replies: Record<string, Reply[]>;
let defaults: Record<string, Reply>;
let calls: { key: string; body?: unknown }[];
let listeners: Set<(state: AppStateStatus) => void>;
let activeAfterFinish: Experiment[];
const count = (key: string) => calls.filter(call => call.key === key).length;
const queue = (key: string, ...items: Reply[]) => { replies[key] = [...(replies[key] ?? []), ...items]; };

function setActive(current: Experiment, timeline = timelineFixture(current, {})) {
  defaults[`GET ${ACTIVE}`] = { body: [current] };
  defaults[`GET /api/experiments/${ID}/progress`] = { body: timeline };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  replies = {}; calls = []; listeners = new Set(); activeAfterFinish = [];
  defaults = {
    'GET /api/profile': { body: profile },
    [COMPLETE]: { body: labReport },
    [READ]: { body: labReport },
    [WRITE]: { body: writtenLabReport },
    [CAPACITY]: { body: { active: 1, limit: 3, can_start: true } },
  };
  setActive(ended);
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.signOut.mockResolvedValue({ error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listeners.add(callback); return { remove: () => listeners.delete(callback) };
  });
  global.fetch = jest.fn(async (url, options) => {
    const path = String(url).replace('http://api.test.invalid:8001', '');
    const key = `${options?.method ?? 'GET'} ${path}`;
    calls.push({ key, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    const reply = replies[key]?.shift() ?? defaults[key];
    if (!reply) throw new Error(`Unexpected fake request: ${key}`);
    if (reply.network) throw new TypeError('Network request failed');
    const status = reply.status ?? 200;
    if (key === COMPLETE && status < 400) defaults[`GET ${ACTIVE}`] = { body: activeAfterFinish };
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const press = (name: string | RegExp) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
async function openFinish() {
  render(<MobileApp />);
  const link = await screen.findByRole('button', { name: /^(See results|See your experiment)$/ });
  await act(async () => { fireEvent.press(link); });
}
async function finish() {
  await openFinish();
  await press('See results');
  await press('Yes, finish');
}
async function openReport(report: LabReport = labReport) {
  defaults[COMPLETE] = { body: report };
  defaults[READ] = { body: report };
  await finish();
  await screen.findByRole('header', { name: 'Prediction vs reality' });
}

describe('finish', () => {
  test('ended days offer Finish with a confirmation that can be cancelled', async () => {
    await openFinish();
    expect(await screen.findByText('Ready for your results.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Finish on the web' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'See results' }));
    expect(screen.getByText("Finish this experiment now? You can't add check-ins after.")).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.getByRole('button', { name: 'See results' })).toBeVisible();
    expect(count(COMPLETE)).toBe(0);
  });

  test('finishing opens the saved report once, with no paid writing call', async () => {
    await openReport();
    expect(count(COMPLETE)).toBe(1);
    expect(count(WRITE)).toBe(0);
    expect(screen.getByRole('button', { name: 'Write my report' })).toBeVisible();
    await waitFor(() => expect(calls.filter(call => call.key === `GET ${ACTIVE}`).length).toBeGreaterThanOrEqual(2));
  });

  test('double taps send one finish', async () => {
    await openFinish();
    await press('See results');
    const button = screen.getByRole('button', { name: 'Yes, finish' });
    await act(async () => { fireEvent.press(button); fireEvent.press(button); });
    await screen.findByRole('header', { name: 'Prediction vs reality' });
    expect(count(COMPLETE)).toBe(1);
  });

  test('too few check-ins are explained with the counts from the backend', async () => {
    queue(COMPLETE, { status: 409, body: { detail: { message: 'Not enough check-ins to complete this experiment yet', baseline_checkins: 1, baseline_required: 2, intervention_checkins: 3, intervention_required: 5 } } });
    await finish();
    expect(await screen.findByText('Not enough check-ins yet: 1 of 2 baseline and 3 of 5 test days.')).toBeVisible();
    expect(count(READ)).toBe(0);
  });

  test.each<[string, Reply]>([
    ['a lost response', { network: true }],
    ['an already completed experiment', { status: 409, body: { detail: 'This experiment is already completed' } }],
  ])('%s reads the current state and opens the report without finishing again', async (_name, reply) => {
    queue(COMPLETE, reply);
    await finish();
    await screen.findByRole('header', { name: 'Prediction vs reality' });
    expect(count(READ)).toBe(1);
    expect(count(COMPLETE)).toBe(1);
  });

  test('a failure with no saved report keeps Finish available, retried by a tap', async () => {
    queue(COMPLETE, { status: 503, body: { detail: 'Database unavailable' } });
    queue(READ, { status: 404, body: { detail: 'No report for this experiment yet' } });
    await finish();
    expect(await screen.findByText('Database unavailable')).toBeVisible();
    expect(count(COMPLETE)).toBe(1);
    await press('Yes, finish');
    await screen.findByRole('header', { name: 'Prediction vs reality' });
    expect(count(COMPLETE)).toBe(2);
  });

  test('an expired session returns to sign-in', async () => {
    queue(COMPLETE, { status: 401, body: {} });
    await finish();
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeVisible();
  });

  test('an in-progress experiment with test days recorded can finish early and says what it skips', async () => {
    setActive(inProgress, timelineFixture(inProgress, { recorded: [1, 2, 3, 4, 5, 6, 7] }));
    await openFinish();
    expect(await screen.findByText('You can finish early.')).toBeVisible();
    expect(screen.getByText("You have enough days recorded to try. Finishing now skips 2 test days, so there's less evidence to go on.")).toBeVisible();
  });

  test('no recorded test day yet means no finish offer', async () => {
    const baselineDay = withProgress('in_progress', { day_number: 2, phase: 'baseline', phase_day: 2, phase_days: 3, days_remaining: 8 });
    setActive(baselineDay, timelineFixture(baselineDay, { recorded: [1] }));
    await openFinish();
    await screen.findByText('Day 2 of 10 · Baseline day 2 of 3');
    expect(screen.queryByRole('button', { name: 'See results' })).toBeNull();
  });

  test('samples are never finished', async () => {
    const sample = { ...ended, is_seeded: true };
    setActive(sample);
    render(<MobileApp />);
    await screen.findByText('This sample has ended. Remove it to free up a slot for a real experiment.');
    expect(screen.queryByRole('button', { name: 'See results' })).toBeNull();
  });

  test('offline disables finishing', async () => {
    await openFinish();
    await screen.findByText('Ready for your results.');
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See results' })).toBeDisabled());
  });
});

describe('comparison', () => {
  test('shows the guess and forecast first, then reveals the measured change on a tap', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    await openReport(guessed(labReport));
    expect(screen.getByText('+12.5%')).toBeVisible();
    expect(screen.getByText('Locked before you saw the AI forecast.')).toBeVisible();
    expect(screen.getByText('+8% to +15%')).toBeVisible();
    expect(screen.queryByText('+21%')).toBeNull();
    await press('Reveal my result');
    expect(screen.getByText('+21%')).toBeVisible();
    expect(screen.getByText('Your result, +21%, landed outside the predicted range. Your guess was 8 percentage points away.')).toBeVisible();
    expect(screen.getByText('61%')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Replay comparison' })).toBeVisible();
  });

  test('an older report without a guess says so', async () => {
    await openReport();
    expect(screen.getByText('No guess was recorded for this experiment.')).toBeVisible();
    await press('Reveal my result');
    expect(screen.getByText('Your result, +21%, landed outside the predicted range.')).toBeVisible();
  });

  test('a report with no comparison stays honest and keeps the guess', async () => {
    await openReportWithoutPrediction();
    expect(screen.getByText(/Your guess: \+12\.5%\. A percentage comparison is unavailable because a baseline or test average is missing, or the baseline is zero\./)).toBeVisible();
    expect(screen.getByText("There wasn't enough data in both phases to compare with the prediction.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reveal my result' })).toBeNull();
  });
  async function openReportWithoutPrediction() {
    const report = { ...labReport, analysis: { ...labReport.analysis, prediction: null, personal_guess: { guessed_change_percent: 12.5, observed_change_percent: null, error_points: null } } };
    defaults[COMPLETE] = { body: report };
    await finish();
    await screen.findByRole('header', { name: 'Prediction vs reality' });
  }

  test('reduced motion reveals at once', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    await openReport();
    await act(async () => { await Promise.resolve(); });
    await press('Reveal my result');
    expect(screen.getByText('+21%')).toBeVisible();
    expect(timing).not.toHaveBeenCalled();
  });

  test('the reveal animates once without reduced motion', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
    await openReport();
    await act(async () => { await Promise.resolve(); });
    const timing = jest.spyOn(Animated, 'timing');
    await press('Reveal my result');
    await waitFor(() => expect(timing).toHaveBeenCalledTimes(1));
  });
});

describe('results', () => {
  test.each<[SignalClass, string, string]>([
    ['likely_signal', 'Likely signal', 'The change was consistent and bigger than your normal day-to-day ups and downs.'],
    ['possible_signal', 'Possible signal', 'It moved the way we expected, but the evidence is still limited.'],
    ['unclear', 'Unclear', "The data doesn't clearly support the idea or rule it out."],
    ['probably_noise', 'Probably noise', 'The changes were small or inconsistent compared with your normal variation.'],
  ])('%s uses the backend label and always says pattern, not proof', async (classification, label, summary) => {
    await openReport({ ...labReport, analysis: { ...labReport.analysis, signal: { ...labReport.analysis.signal, classification } } });
    expect(screen.getByRole('header', { name: label })).toBeVisible();
    expect(screen.getByText(summary)).toBeVisible();
    expect(screen.getAllByText(/A short personal experiment shows a pattern, not proof\./).length).toBeGreaterThan(0);
  });

  test.each<[SignalReason, string]>([
    ['insufficient_data', "One of the phases didn't have enough check-ins to compare."],
    ['change_meets_success_criteria', 'The change reached at least 10%, the size we set out to look for.'],
    ['change_below_success_criteria', 'It moved the expected way, but by less than the 10% we set out to look for.'],
    ['consistent_direction', 'Most test days moved in the same direction.'],
    ['inconsistent_direction', 'Test days went up and down without a clear pattern.'],
    ['larger_than_normal_variation', 'The change was bigger than your normal day-to-day variation.'],
    ['within_normal_variation', 'The change stayed within your normal day-to-day variation.'],
    ['low_adherence', 'You made the change on fewer than 6 in 10 test days.'],
    ['few_intervention_days', 'Fewer than 5 test days were logged, so treat this as a first look.'],
    ['moved_opposite_to_prediction', 'It moved the opposite way to the prediction.'],
  ])('explains the reason %s', async (reason, text) => {
    await openReport({ ...labReport, analysis: { ...labReport.analysis, signal: { ...labReport.analysis.signal, reasons: [reason] } } });
    expect(screen.getByText(text)).toBeVisible();
  });

  test('uses the analysis for the change, adherence and other measures', async () => {
    await openReport();
    expect(screen.getByText('Morning energy: +21% on test days compared with your baseline (5.3 → 6.4 on average).')).toBeVisible();
    expect(screen.getByText('3 of 3')).toBeVisible();
    expect(screen.getByText('7 of 7')).toBeVisible();
    expect(screen.getByText('6 of 7')).toBeVisible();
    expect(screen.getByText('None')).toBeVisible();
    expect(screen.getByText('Sleep quality')).toBeVisible();
    expect(screen.getByText('6.3 → 7.3 +15%')).toBeVisible();
  });

  test('a sample report is labelled', async () => {
    await openReport({ ...labReport, experiment: { ...labReport.experiment, is_seeded: true } });
    expect(screen.getByText('Sample experiment')).toBeVisible();
    expect(screen.getByText('This report is based on seeded example check-ins.')).toBeVisible();
  });
});

describe('chart', () => {
  const report = (points: LabReport['chart']['points'], predicted_band = labReport.chart.predicted_band): LabReport => ({
    ...labReport, chart: { ...labReport.chart, points, predicted_band },
  });
  const gap = labReport.chart.points.map(point => point.day === 5
    ? { ...point, logged: false, missed: true, value: null, values: null, intervention_completed: null, note: null }
    : point.day >= 9 ? { ...point, logged: false, missed: false, value: null, values: null, intervention_completed: null, note: null } : point);

  test('describes the chart in words, from the returned numbers', async () => {
    await openReport();
    expect(screen.getByLabelText('Morning energy by day, days 1 to 10. Baseline average 5.3. Predicted range 5.8 to 6.1. Missed: none.')).toBeVisible();
  });

  test('a missed day breaks the line, and missed and unreached days are named in words', async () => {
    await openReport(report(gap));
    expect(screen.UNSAFE_getAllByType(Polyline)).toHaveLength(2);
    expect(screen.getByText('Missed: day 5.')).toBeVisible();
    expect(screen.getByText('Not reached before you finished: days 9, 10.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Day 4, test: 6' })).toBeVisible();
    expect(screen.getByLabelText('Day 5, test: missed')).toBeVisible();
    expect(screen.getByLabelText('Day 9, test: not reached')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Day 5, test: missed' })).toBeNull();
  });

  test('tapping a day shows its answers and note', async () => {
    await openReport();
    const skipped = labReport.chart.points.find(point => point.day === 6)!;
    fireEvent.press(screen.getByRole('button', { name: `Day 6, test, change skipped: ${skipped.value}` }));
    const panel = within(screen.getByLabelText('Details for day 6'));
    expect(panel.getByText('Day 6 · Test · skipped the change')).toBeVisible();
    expect(panel.getByText('Sleep quality')).toBeVisible();
    expect(panel.getByText('“Late dinner, skipped the walk.”')).toBeVisible();
  });

  test('a missing band is left out and no recorded days are explained', async () => {
    await openReport(report(gap.map(point => ({ ...point, logged: false, missed: true, value: null, values: null })), null));
    expect(screen.getByText("Nothing was recorded for this measure, so there's no line to draw.")).toBeVisible();
    expect(screen.queryByText(/Predicted range:/)).toBeNull();
  });
});

describe('written report', () => {
  test('is never written on opening or returning to the foreground', async () => {
    await openReport();
    await act(async () => { for (const listener of listeners) listener('active'); });
    expect(count(WRITE)).toBe(0);
  });

  test('one tap writes once, without regenerating, and shows every section', async () => {
    await openReport();
    const button = screen.getByRole('button', { name: 'Write my report' });
    await act(async () => { fireEvent.press(button); fireEvent.press(button); });
    const narrative = writtenLabReport.narrative!;
    expect(await screen.findByText(narrative.summary)).toBeVisible();
    expect(screen.getByText(narrative.interpretation)).toBeVisible();
    narrative.personal_learnings.forEach(item => expect(screen.getByText(`• ${item}`)).toBeVisible());
    narrative.confounders.forEach(item => expect(screen.getByText(`• ${item}`)).toBeVisible());
    expect(screen.getByText(narrative.next_experiment.question)).toBeVisible();
    expect(count(WRITE)).toBe(1);
    expect(calls.some(call => call.key.includes('regenerate'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Write my report' })).toBeNull();
  });

  test('a written report offers no way to write again', async () => {
    await openReport(writtenLabReport);
    expect(screen.queryByRole('button', { name: 'Write my report' })).toBeNull();
    expect(count(WRITE)).toBe(0);
  });

  test.each<[number, string]>([
    [503, "The writing service isn't available right now."],
    [502, "We couldn't write a report that matched your results."],
  ])('a %i keeps the results and retries only on a tap', async (status, text) => {
    await openReport();
    queue(WRITE, { status, body: { detail: 'x' } });
    await press('Write my report');
    expect(await screen.findByText(`${text} Your results above are saved.`)).toBeVisible();
    expect(screen.getByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
    await act(async () => { for (const listener of listeners) listener('active'); });
    expect(count(WRITE)).toBe(1);
    await press('Try again');
    await screen.findByText(writtenLabReport.narrative!.summary);
    expect(count(WRITE)).toBe(2);
  });

  test("a sample with a guess says the guess is invented too", async () => {
    await openReport(guessed({ ...labReport, experiment: { ...labReport.experiment, is_seeded: true } }));
    expect(await screen.findByText('This report is based on seeded example check-ins and an invented guess.')).toBeVisible();
  });

  test('the daily limit shows its message, keeps the results and offers no retry', async () => {
    await openReport();
    const text = "You've used all of today's written reports. You can write this one tomorrow.";
    queue(WRITE, { status: 429, body: { detail: { code: 'ai_daily_limit', message: text, limit: 3 } } });
    await press('Write my report');
    expect(await screen.findByText(`${text} Your results above are saved.`)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(count(WRITE)).toBe(1);
  });

  test.each<[number, string]>([
    [409, 'This experiment needs to be finished before its report can be written.'],
    [404, 'There are no results to write about yet.'],
  ])('a %i cannot be retried', async (status, text) => {
    await openReport();
    queue(WRITE, { status, body: { detail: 'x' } });
    await press('Write my report');
    expect(await screen.findByText(`${text} Your results above are saved.`)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  test('offline disables writing and keeps the results on screen', async () => {
    await openReport();
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Write my report' })).toBeDisabled());
    expect(screen.getByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
    expect(screen.getByText("You're offline. These results are the last ones loaded.")).toBeVisible();
  });

  test('a seeded report never offers paid writing', async () => {
    await openReport({ ...labReport, experiment: { ...labReport.experiment, is_seeded: true } });
    expect(screen.queryByRole('button', { name: 'Write my report' })).toBeNull();
    expect(screen.getByText('This sample has no written report.')).toBeVisible();
  });

  test('an expired session while writing returns to sign-in', async () => {
    await openReport();
    queue(WRITE, { status: 401, body: {} });
    await press('Write my report');
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeVisible();
  });
});

describe('run this experiment', () => {
  const next = writtenLabReport.narrative!.next_experiment.question;

  test('prefills the native question with no paid call until the explicit tap', async () => {
    await openReport(writtenLabReport);
    fireEvent.press(await screen.findByRole('button', { name: 'Run this experiment' }));
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe(next);
    await act(async () => { await Promise.resolve(); });
    expect(count(PROPOSE)).toBe(0);
    defaults[PROPOSE] = { body: { ...proposeResponse, personal_guess_available: true } };
    await press('Design experiment');
    await screen.findByRole('header', { name: 'What do you think will happen?' });
    expect(calls.find(call => call.key === PROPOSE)?.body).toEqual({ question: next });
  });

  test('at the limit, it links back to Your lab instead', async () => {
    defaults[COMPLETE] = { body: writtenLabReport };
    defaults[READ] = { body: writtenLabReport };
    defaults[CAPACITY] = { body: { active: 3, limit: 3, can_start: false } };
    await finish();
    expect(await screen.findByText("You're running 3 experiments, the most at once. Finish one before starting this one.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Run this experiment' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
  });

  test('with another experiment running below the limit, it still offers the next one', async () => {
    defaults[COMPLETE] = { body: writtenLabReport };
    defaults[READ] = { body: writtenLabReport };
    defaults[CAPACITY] = { body: { active: 2, limit: 3, can_start: true } };
    await finish();
    expect(await screen.findByRole('button', { name: 'Run this experiment' })).toBeVisible();
  });

  test('the report says plainly when another experiment overlapped, in the backend\'s words', async () => {
    const description = 'You were also testing "Does less coffee help?" on 4 of your 7 recorded test days, so part of this change may come from that.';
    const withOverlap = { ...writtenLabReport, analysis: { ...writtenLabReport.analysis, overlaps: [{
      experiment_id: 'other-id', question: 'Does less coffee help?', test_days_overlapping: 4, baseline_days_overlapping: 0, description,
    }] } };
    defaults[COMPLETE] = { body: withOverlap };
    defaults[READ] = { body: withOverlap };
    await finish();
    expect(await screen.findByRole('header', { name: 'Other experiments at the same time' })).toBeVisible();
    expect(screen.getByText(description)).toBeVisible();
  });

  test('a report with no overlap shows no overlap section', async () => {
    defaults[COMPLETE] = { body: writtenLabReport };
    defaults[READ] = { body: writtenLabReport };
    await finish();
    await screen.findByRole('button', { name: 'Run this experiment' });
    expect(screen.queryByRole('header', { name: 'Other experiments at the same time' })).toBeNull();
  });

  test('a failed limit check still lets the person continue, since the backend checks again', async () => {
    await openReport();
    defaults[CAPACITY] = { status: 503, body: {} };
    await press('Write my report');
    expect(await screen.findByRole('button', { name: 'Run this experiment' })).toBeVisible();
  });

  test('no narrative still offers your own question', async () => {
    await openReport();
    expect(screen.getByText('A suggested next question appears once your report is written.')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Ask your own question' }));
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.getByLabelText('Your question or goal').props.value).toBe('');
  });
});

describe('opening a report', () => {
  const completedState = withProgress('completed');
  const openFromToday = async () => {
    setActive(completedState);
    render(<MobileApp />);
    const button = await screen.findByRole('button', { name: 'See your Lab Report' });
    await act(async () => { fireEvent.press(button); });
  };

  test('loads the saved report natively, with no writing call', async () => {
    await openFromToday();
    expect(await screen.findByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
    expect(count(READ)).toBe(1);
    expect(count(WRITE)).toBe(0);
  });

  test('a read failure offers retry and is not shown as an empty report', async () => {
    queue(READ, { status: 503, body: { detail: 'Database unavailable' } });
    await openFromToday();
    expect(await screen.findByText(/We couldn't load this report\. Database unavailable/)).toBeVisible();
    await press('Try again');
    expect(await screen.findByRole('header', { name: 'Prediction vs reality' })).toBeVisible();
  });

  test('a missing report checks the experiment and says results are not ready', async () => {
    queue(READ, { status: 404, body: { detail: 'No report for this experiment yet' } });
    defaults[`GET /api/experiments/${ID}`] = { body: { ...completedState, status: 'completed' } };
    await openFromToday();
    expect(await screen.findByText('No results yet.')).toBeVisible();
    expect(screen.getByText("This experiment is finished, but its report isn't available. Try again in a moment.")).toBeVisible();
  });

  test('an inaccessible experiment is told apart from a missing report', async () => {
    queue(READ, { status: 404, body: { detail: 'Experiment not found' } });
    defaults[`GET /api/experiments/${ID}`] = { status: 404, body: { detail: 'Experiment not found' } };
    await openFromToday();
    expect(await screen.findByText("We couldn't find that experiment.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  test('offline before loading says so and sends nothing', async () => {
    setActive(completedState);
    render(<MobileApp />);
    const button = await screen.findByRole('button', { name: 'See your Lab Report' });
    mockNetwork.isConnected = false;
    screen.rerender(<MobileApp />);
    await act(async () => { fireEvent.press(button); });
    expect(await screen.findByText('Reconnect to load this report.')).toBeVisible();
    expect(count(READ)).toBe(0);
  });

  test('Back returns to Today', async () => {
    await openFromToday();
    await screen.findByRole('header', { name: 'Prediction vs reality' });
    await press('Back to today');
    expect(await screen.findByRole('button', { name: 'See your Lab Report' })).toBeVisible();
  });
});
