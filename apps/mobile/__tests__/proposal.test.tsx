import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, AppState, StyleSheet, type AppStateStatus } from 'react-native';
import type { Experiment, ProposeResponse } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { experiment, profile, proposeResponse } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ACTIVE = '/api/experiments?status=active';
const QUESTION = 'Does walking after dinner help my mornings?';
const session = { access_token: 'fake-token', user: { id: 'fake-user', email: 'learner@example.invalid' } };
const withGuess: ProposeResponse = { ...proposeResponse, personal_guess_available: true };
const saved: Experiment = { ...experiment, id: 'saved-id', status: 'proposed' };
const started: Experiment = { ...saved, status: 'active', progress: {
  ...experiment.progress, state: 'in_progress', day_number: 1, phase: 'baseline', phase_day: 1, phase_days: 3,
  days_remaining: 9, started_at: '2026-11-03T09:00:00Z',
} };
const timeline = timelineFixture(started, {});

type Reply = { status?: number; body?: unknown; network?: boolean };
let replies: Record<string, Reply[]>;
let defaults: Record<string, Reply>;
let calls: { key: string; body?: unknown }[];
let listeners: Set<(state: AppStateStatus) => void>;
let authListener: (event: string, current: typeof session | null) => void;

const count = (key: string) => calls.filter(call => call.key === key).length;
const PROPOSE = 'POST /api/experiments/propose';
const SAVE = 'POST /api/experiments';
const START = `POST /api/experiments/${saved.id}/start`;
const queue = (key: string, ...items: Reply[]) => { replies[key] = [...(replies[key] ?? []), ...items]; };

beforeEach(() => {
  jest.clearAllMocks();
  mockNetwork.isConnected = mockNetwork.isInternetReachable = true;
  replies = {}; calls = []; listeners = new Set();
  defaults = {
    'GET /api/profile': { body: profile },
    [`GET ${ACTIVE}`]: { body: [] },
    [PROPOSE]: { body: withGuess },
    [SAVE]: { status: 201, body: saved },
    [START]: { body: started },
    [`GET /api/experiments/${saved.id}/progress`]: { body: timeline },
  };
  mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuth.onAuthStateChange.mockImplementation(callback => { authListener = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
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
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

async function openAsk() {
  render(<MobileApp />);
  await screen.findByRole('header', { name: 'Ask a question.' });
}
function typeQuestion(text = QUESTION) { fireEvent.changeText(screen.getByLabelText('Your question or goal'), text); }
const design = () => screen.getByRole('button', { name: 'Design experiment' });
async function submit(text = QUESTION) { typeQuestion(text); await act(async () => { fireEvent.press(design()); }); }
async function toGuess() { await openAsk(); await submit(); await screen.findByRole('header', { name: 'What do you think will happen?' }); }
async function reveal(value = '+12') {
  fireEvent.changeText(screen.getByLabelText('Your guess for Morning energy'), value);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Show prediction' })); });
}
async function toPlan() { await toGuess(); await reveal(); await screen.findByRole('button', { name: 'Start this experiment' }); }
const startNow = async () => { await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Start this experiment' })); }); };

test('no active experiment opens the native question, not the web', async () => {
  await openAsk();
  expect(screen.queryByRole('link', { name: 'Start an experiment on the web' })).toBeNull();
  expect(count(PROPOSE)).toBe(0);
});

test('suggestions from the goals only fill the field and never make a paid call', async () => {
  queue('GET /api/profile', { body: { ...profile, goals: ['More energy in the morning'] } });
  await openAsk();
  fireEvent.press(screen.getByRole('button', { name: 'What could give me more energy in the morning?' }));
  expect(screen.getByLabelText('Your question or goal').props.value).toBe('What could give me more energy in the morning?');
  await act(async () => { await Promise.resolve(); });
  expect(count(PROPOSE)).toBe(0);
  expect(count(`GET ${ACTIVE}`)).toBe(1);
});

test.each(['', '   ', 'abc', 'a'.repeat(501)])('an out-of-range question cannot be sent: "%s"', async text => {
  await openAsk();
  typeQuestion(text);
  expect(design()).toBeDisabled();
  await act(async () => { fireEvent.press(design()); });
  expect(count(PROPOSE)).toBe(0);
});

test('sends the trimmed question directly, because the backend checks the limit first', async () => {
  await openAsk();
  const reads = count(`GET ${ACTIVE}`);
  await submit(`  ${QUESTION}  `);
  await screen.findByRole('header', { name: 'What do you think will happen?' });
  expect(count(`GET ${ACTIVE}`)).toBe(reads);
  expect(calls.find(call => call.key === PROPOSE)?.body).toEqual({ question: QUESTION });
});

test('the limit from the backend is explained, and Design stays off until the question changes', async () => {
  await openAsk();
  queue(PROPOSE, { status: 409, body: { detail: { code: 'active_limit_reached', message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } } });
  await submit();
  expect(await screen.findByText("You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
  expect(screen.queryByText('Your profile needs to be saved first.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Design experiment' })).toBeDisabled();
  expect(count(PROPOSE)).toBe(1);
});

test('double taps send one proposal, with no second request while it is in flight', async () => {
  await openAsk();
  let release!: (reply: Response) => void;
  const fake = global.fetch as jest.Mock; const original = fake.getMockImplementation()!;
  fake.mockImplementation(async (url, options) => {
    if (String(url).endsWith('/propose')) {
      calls.push({ key: PROPOSE });
      return new Promise<Response>(resolve => { release = resolve; });
    }
    return original(url, options);
  });
  typeQuestion();
  const button = design();
  await act(async () => { fireEvent.press(button); fireEvent.press(button); });
  expect(await screen.findByRole('header', { name: 'Planning your experiment.' })).toBeVisible();
  expect(count(PROPOSE)).toBe(1);
  await act(async () => { release({ ok: true, status: 200, json: async () => withGuess } as Response); });
  await screen.findByRole('header', { name: 'What do you think will happen?' });
  expect(count(PROPOSE)).toBe(1);
});

test('returning to the foreground keeps the proposal and never sends it again', async () => {
  await toPlan();
  await act(async () => { for (const listener of listeners) listener('active'); });
  expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeVisible();
  expect(screen.getByText('Your guess: +12% change from normal days. Locked before the AI reveal.')).toBeVisible();
  expect(count(PROPOSE)).toBe(1);
});

test('a token refresh whose profile read fails does not lose the paid proposal', async () => {
  await toPlan();
  queue('GET /api/profile', { status: 503, body: {} });
  await act(async () => { authListener('TOKEN_REFRESHED', { ...session, access_token: 'fresh-token' }); });
  await waitFor(() => expect(count('GET /api/profile')).toBe(2));
  expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeVisible();
  expect(count(PROPOSE)).toBe(1);
});

test('a safety block shows the reason and a safer alternative that only fills the field', async () => {
  await openAsk();
  queue(PROPOSE, { body: { ...proposeResponse, proposal: null, prediction: null,
    safety: { allowed: false, reason: 'This would cut sleep too far.', suggested_alternative: 'Try a small change, and ask a clinician about anything medical.', suggested_question: 'Does an earlier bedtime help my mornings?' } } });
  await submit();
  expect(await screen.findByText("Let's find a gentler experiment.")).toBeVisible();
  expect(screen.getByText('This would cut sleep too far.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Start this experiment' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Use this instead' }));
  expect(screen.getByLabelText('Your question or goal').props.value).toBe('Does an earlier bedtime help my mornings?');
  expect(count(PROPOSE)).toBe(1);
});

test('a review-level question shows the note before the plan', async () => {
  await openAsk();
  queue(PROPOSE, { body: { ...proposeResponse, safety: { allowed: true, reason: 'Go gently with this one.', suggested_alternative: null },
    classification: { ...proposeResponse.classification, risk: 'review' } } });
  await submit();
  expect(await screen.findByText('A note before you begin')).toBeVisible();
  expect(screen.getByText('Go gently with this one.')).toBeVisible();
});

test('an incomplete plan is an error, retried only by an explicit tap', async () => {
  await openAsk();
  queue(PROPOSE, { body: { ...proposeResponse, prediction: null } });
  await submit();
  expect(await screen.findByText(/The plan came back incomplete\. Please retry\./)).toBeVisible();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
  expect(count(PROPOSE)).toBe(1);
  await act(async () => { await Promise.resolve(); });
  expect(count(PROPOSE)).toBe(1);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry' })); });
  expect(count(PROPOSE)).toBe(2);
});

test.each([
  [503, 'AI service unavailable, please try again', /The service is unavailable right now\./],
  [502, 'Could not generate a valid experiment, please try again', /We couldn't put together a complete plan\./],
  [422, 'Too vague', /Let's adjust that question\./],
])('%i keeps the question and explains what happened', async (status, detail, title) => {
  await openAsk();
  queue(PROPOSE, { status, body: { detail } });
  await submit();
  expect(await screen.findByText(title)).toBeVisible();
  expect(screen.getByText(new RegExp(detail))).toBeVisible();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
  expect(count(PROPOSE)).toBe(1);
});

test('the daily limit explains itself, keeps the question and offers no retry', async () => {
  await openAsk();
  const text = "You've used all of today's experiment plans. Please come back tomorrow.";
  queue(PROPOSE, { status: 429, body: { detail: { code: 'ai_daily_limit', message: text, limit: 5 } } });
  await submit();
  expect(await screen.findByText(new RegExp(text))).toBeVisible();
  expect(screen.getByText(/You've reached today's limit\./)).toBeVisible();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(count(PROPOSE)).toBe(1);
});

test('a missing profile routes to the rhythm instead of retrying', async () => {
  await openAsk();
  queue(PROPOSE, { status: 409, body: { detail: 'Create your profile first' } });
  await submit();
  expect(await screen.findByText(/Your profile needs to be saved first\./)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Go to your rhythm' })).toBeVisible();
});

test('the forecast stays hidden until the guess is locked', async () => {
  await toGuess();
  expect(screen.queryByText(/\+8% to \+15%/)).toBeNull();
  expect(screen.queryByText('We predict')).toBeNull();
  expect(screen.getByText(withGuess.proposal!.intervention.action)).toBeVisible();
  await reveal();
  expect(await screen.findByText('We predict')).toBeVisible();
  expect(screen.getByText('+8% to +15%')).toBeVisible();
  expect(screen.getByText('Your guess: +12% change from normal days. Locked before the AI reveal.')).toBeVisible();
  expect(screen.queryByLabelText('Your guess for Morning energy')).toBeNull();
});

test.each([['0', '0%'], ['-5', '-5%'], ['+12', '+12%'], ['7,5', '+7.5%'], ['-100', '-100%'], ['200', '+200%']])('accepts the guess %s', async (value, shown) => {
  await toGuess();
  await reveal(value);
  expect(await screen.findByText(`Your guess: ${shown} change from normal days. Locked before the AI reveal.`)).toBeVisible();
});

test.each(['', 'abc', '-101', '201', '1e2', '--2', '1,2,3'])('rejects the guess "%s"', async value => {
  await toGuess();
  fireEvent.changeText(screen.getByLabelText('Your guess for Morning energy'), value);
  expect(screen.getByRole('button', { name: 'Show prediction' })).toBeDisabled();
  expect(screen.queryByText('We predict')).toBeNull();
});

test('when the guess column is missing there is no field, and starting saves no guess', async () => {
  await openAsk();
  queue(PROPOSE, { body: proposeResponse });
  await submit();
  expect(await screen.findByText('Your own guess is unavailable right now. You can still start without one.')).toBeVisible();
  expect(screen.queryByLabelText('Your guess for Morning energy')).toBeNull();
  expect(screen.getByText('We predict')).toBeVisible();
  await startNow();
  await waitFor(() => expect(count(START)).toBe(1));
  expect(calls.find(call => call.key === SAVE)?.body).not.toHaveProperty('personal_guess_percent');
});

test('the plan explains the change, the days, the measures and the success rule', async () => {
  await toPlan();
  const { proposal } = withGuess;
  expect(screen.getByText(proposal!.intervention.action)).toBeVisible();
  expect(screen.getByText('3 normal days, then 7 test days')).toBeVisible();
  expect(screen.getByText('Fixed once you start.')).toBeVisible();
  expect(screen.queryByText(proposal!.hypothesis)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Why?' }));
  expect(screen.getByText(proposal!.hypothesis)).toBeVisible();
  expect(screen.getByText('We track: Morning energy, Sleep quality.')).toBeVisible();
  expect(screen.getByText('We look for a change of at least 10% in Morning energy.')).toBeVisible();
});

test('Ask something else clears the proposal and guess', async () => {
  await toPlan();
  fireEvent.press(screen.getByRole('button', { name: 'Ask something else' }));
  expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe('');
  expect(screen.queryByText(/Your guess:/)).toBeNull();
  await submit();
  expect(await screen.findByLabelText('Your guess for Morning energy')).toBeVisible();
  expect(screen.getByLabelText('Your guess for Morning energy').props.value).toBe('');
  expect(count(PROPOSE)).toBe(2);
});

test('starting saves the locked guess once, starts, and lands on Today', async () => {
  await toPlan();
  queue(`GET ${ACTIVE}`, { body: [started] });
  await startNow();
  expect(await screen.findByText(started.question)).toBeVisible();
  expect(screen.getByText('Your experiment has started.')).toBeVisible();
  expect(screen.getByText('Day 1 of 10')).toBeVisible();
  const order = calls.map(call => call.key);
  expect(order.indexOf(SAVE)).toBeGreaterThan(order.lastIndexOf(PROPOSE));
  expect(order.indexOf(START)).toBeGreaterThan(order.indexOf(SAVE));
  expect(calls.find(call => call.key === SAVE)?.body).toEqual({
    proposal: withGuess.proposal, prediction: withGuess.prediction, category: withGuess.classification.category, personal_guess_percent: 12,
  });
  expect(count(PROPOSE)).toBe(1);
  expect(count(SAVE)).toBe(1);
});

test('double taps on Start save and start once', async () => {
  await toPlan();
  queue(`GET ${ACTIVE}`, { body: [started] });
  const button = screen.getByRole('button', { name: 'Start this experiment' });
  await act(async () => { fireEvent.press(button); fireEvent.press(button); });
  await screen.findByText(started.question);
  expect(count(SAVE)).toBe(1);
  expect(count(START)).toBe(1);
});

test('the limit reached at the last moment keeps the plan, and retrying makes no second draft', async () => {
  await toPlan();
  queue(START, { status: 409, body: { detail: { code: 'active_limit_reached', message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } } });
  await startNow();
  expect(await screen.findByText("Your experiment was saved, but it couldn't start yet. You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
  queue(`GET ${ACTIVE}`, { body: [started] });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); });
  await screen.findByText(started.question);
  expect(count(SAVE)).toBe(1);
  expect(count(START)).toBe(2);
});

test('a failed start retries only the start, never a second draft', async () => {
  await toPlan();
  queue(START, { status: 503, body: { detail: 'Database unavailable' } });
  await startNow();
  expect(await screen.findByText(/Your experiment was saved, but it couldn't be started: Try again\./)).toBeVisible();
  queue(`GET ${ACTIVE}`, { body: [started] });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); });
  await screen.findByText(started.question);
  expect(count(SAVE)).toBe(1);
  expect(count(START)).toBe(2);
  expect(count(PROPOSE)).toBe(1);
});

test('a save failure keeps the plan and retries without another paid call', async () => {
  await toPlan();
  queue(SAVE, { network: true });
  await startNow();
  expect(await screen.findByText(/Couldn't reach the server/)).toBeVisible();
  queue(`GET ${ACTIVE}`, { body: [started] });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); });
  await screen.findByText(started.question);
  expect(count(PROPOSE)).toBe(1);
  expect(count(SAVE)).toBe(2);
});

test('only the guess error offers to continue without saving it, and only on that tap', async () => {
  await toPlan();
  queue(SAVE, { status: 409, body: { detail: { code: 'personal_guess_unavailable', message: 'Your guess could not be saved yet.' } } });
  await startNow();
  expect(await screen.findByText('Your guess could not be saved yet.')).toBeVisible();
  expect(count(START)).toBe(0);
  queue(`GET ${ACTIVE}`, { body: [started] });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Skip my guess' })); });
  await screen.findByText(started.question);
  expect(calls.filter(call => call.key === SAVE)[1]?.body).not.toHaveProperty('personal_guess_percent');
});

test('other save errors do not offer to drop the guess', async () => {
  await toPlan();
  queue(SAVE, { status: 503, body: { detail: 'Database unavailable' } });
  await startNow();
  expect(await screen.findByText(/Couldn't save your experiment\. Try again\./)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Skip my guess' })).toBeNull();
});

test('a start that already went through is recognised, not reported as a failure', async () => {
  await toPlan();
  queue(START, { status: 409, body: { detail: 'Only a proposed experiment can be started (this one is active)' } });
  // Not first in the list: with several running, the whole list has to be searched.
  queue(`GET ${ACTIVE}`, { body: [{ ...started, id: 'other-id' }, started] });
  await startNow();
  expect(await screen.findByText('Your experiment has started.')).toBeVisible();
  expect(count(START)).toBe(1);
});

test('offline keeps the question and disables paid and saving actions', async () => {
  await openAsk();
  typeQuestion();
  mockNetwork.isConnected = false;
  screen.rerender(<MobileApp />);
  expect(await screen.findByText("You're offline. Your question is kept; reconnect to design your experiment.")).toBeVisible();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe(QUESTION);
  expect(design()).toBeDisabled();
  await act(async () => { fireEvent.press(design()); });
  expect(count(PROPOSE)).toBe(0);
});

test('offline on the plan keeps it and disables Start', async () => {
  await toPlan();
  mockNetwork.isConnected = false;
  screen.rerender(<MobileApp />);
  expect(await screen.findByText("You're offline. Your plan is kept; reconnect to start.")).toBeVisible();
  expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeDisabled();
});

test('a 401 from the proposal returns to sign-in', async () => {
  await openAsk();
  queue(PROPOSE, { status: 401, body: {} });
  await submit();
  expect(await screen.findByText('Your session has expired. Sign in again.')).toBeVisible();
  expect(count(PROPOSE)).toBe(1);
});

test('reduced motion shows the forecast range without animating', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  await toPlan();
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText('Expected change range +8% to +15%')).toBeVisible();
  expect(timing).not.toHaveBeenCalled();
});

test('the forecast range animates once without reduced motion', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
  const timing = jest.spyOn(Animated, 'timing');
  await toPlan();
  await waitFor(() => expect(timing).toHaveBeenCalledTimes(1));
});

const TRUST = 'Your question goes to an AI to design the experiment, and the AI puts your results into words. The numbers come from your own check-ins.';

test('Ask says where the question goes and that the AI does not calculate the result', async () => {
  await openAsk();
  expect(screen.getByText(TRUST)).toBeVisible();
});

test('You has an About section with the same line', async () => {
  render(<MobileApp />);
  const you = await screen.findByRole('tab', { name: 'You' });
  await act(async () => { fireEvent.press(you); });
  expect(screen.getByRole('header', { name: 'About' })).toBeVisible();
  expect(screen.getByText(TRUST)).toBeVisible();
});

test('starter chips are always plain questions, even for a goal without one written', async () => {
  queue('GET /api/profile', { body: { ...profile, goals: ['More energy in the morning', 'better morning energy'] } });
  await openAsk();
  expect(screen.getByRole('button', { name: 'What could give me more energy in the morning?' })).toBeVisible();
  expect(screen.queryByText(/What small change could help with/)).toBeNull();
});

test('the sample offer leaves once a plan is open, and comes back when it is cleared', async () => {
  render(<MobileApp />);
  fireEvent.changeText(await screen.findByLabelText('Your question or goal'), 'Does a walk after dinner help my energy?');
  expect(screen.getByRole('button', { name: 'Try a sample experiment' })).toBeVisible();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Design experiment' })); });
  await screen.findByText('What do you think will happen?');
  expect(screen.queryByRole('button', { name: 'Try a sample experiment' })).toBeNull();
  fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '12');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Show prediction' })); });
  await screen.findByRole('button', { name: 'Start this experiment' });
  expect(screen.queryByRole('button', { name: 'Try a sample experiment' })).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Ask something else' })); });
  expect(await screen.findByRole('button', { name: 'Try a sample experiment' })).toBeVisible();
});

describe('a question that is not about a habit', () => {
  const OFF_TOPIC = "What's the capital of France?";
  const SUGGESTED = 'Does a 20-minute walk after dinner improve my morning energy?';
  const softCheck: ProposeResponse = { ...withGuess, proposal: null, prediction: null,
    habit_check: { message: "This doesn't look like a habit question.", suggested_question: SUGGESTED } };

  test('shows the check, a rewording and both choices, with no plan', async () => {
    await openAsk();
    queue(PROPOSE, { body: softCheck });
    await submit(OFF_TOPIC);
    expect(await screen.findByText("This doesn't look like a habit question.")).toBeVisible();
    expect(screen.getByText(SUGGESTED)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use this instead' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue anyway' })).toBeVisible();
    expect(screen.queryByText(/The plan came back incomplete/)).toBeNull();
    expect(screen.queryByLabelText('Suggestions')).toBeNull(); // Both choices stay on screen, without scrolling.
    expect(count(PROPOSE)).toBe(1);
  });

  test('Use this instead fills in the rewording and asks nothing until the person does', async () => {
    await openAsk();
    queue(PROPOSE, { body: softCheck });
    await submit(OFF_TOPIC);
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Use this instead' })); });
    expect(screen.getByLabelText('Your question or goal').props.value).toBe(SUGGESTED);
    expect(screen.queryByText("This doesn't look like a habit question.")).toBeNull();
    expect(count(PROPOSE)).toBe(1);
  });

  test('Continue anyway carries on to the plan, saying so to the server', async () => {
    await openAsk();
    queue(PROPOSE, { body: softCheck });
    await submit(OFF_TOPIC);
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Continue anyway' })); });
    expect(await screen.findByRole('header', { name: 'What do you think will happen?' })).toBeVisible();
    expect(calls.filter(call => call.key === PROPOSE).map(call => call.body)).toEqual([
      { question: OFF_TOPIC }, { question: OFF_TOPIC, continue_anyway: true },
    ]);
  });

  test('a retry after Continue anyway does not ask the same thing twice', async () => {
    await openAsk();
    queue(PROPOSE, { body: softCheck }, { status: 503, body: { detail: 'AI service unavailable, please try again' } });
    await submit(OFF_TOPIC);
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Continue anyway' })); });
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Retry' })); });
    expect(calls.filter(call => call.key === PROPOSE).at(-1)?.body).toEqual({ question: OFF_TOPIC, continue_anyway: true });
  });

  test('editing the question starts again without the override', async () => {
    await openAsk();
    queue(PROPOSE, { body: softCheck });
    await submit(OFF_TOPIC);
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Continue anyway' })); });
    await screen.findByRole('header', { name: 'What do you think will happen?' });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /Ask something else|Back/ })); });
    await submit(QUESTION);
    expect(calls.filter(call => call.key === PROPOSE).at(-1)?.body).toEqual({ question: QUESTION });
  });
});

test('a safety block with only advice shows it as text, offers nothing to fill, and leaves the box empty', async () => {
  await openAsk();
  const advice = 'Try a small, low-risk habit change, such as a consistent bedtime, and ask a clinician about anything medical.';
  queue(PROPOSE, { body: { ...proposeResponse, proposal: null, prediction: null,
    safety: { allowed: false, reason: "This request isn't suitable.", suggested_alternative: advice, suggested_question: null } } });
  await submit();
  expect(await screen.findByText(advice)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Use this instead' })).toBeNull();
  expect(screen.getByLabelText('Your question or goal').props.value).toBe('');
  expect(count(PROPOSE)).toBe(1);
});

test('advice is never what fills the box, even with a testable question on offer', async () => {
  await openAsk();
  const advice = 'Try a small change, and ask a clinician about anything medical.';
  queue(PROPOSE, { body: { ...proposeResponse, proposal: null, prediction: null,
    safety: { allowed: false, reason: 'Not this one.', suggested_alternative: advice, suggested_question: 'Does a consistent bedtime help me feel rested?' } } });
  await submit();
  expect(await screen.findByText('Does a consistent bedtime help me feel rested?')).toBeVisible();
  expect(screen.queryByText(advice)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Use this instead' }));
  expect(screen.getByLabelText('Your question or goal').props.value).toBe('Does a consistent bedtime help me feel rested?');
});

describe('the planning moment', () => {
  let release: (reply: Response) => void;
  const hold = () => {
    const fake = global.fetch as jest.Mock; const original = fake.getMockImplementation()!;
    fake.mockImplementation((url, options) => {
      if (!String(url).endsWith('/propose')) return original(url, options);
      calls.push({ key: PROPOSE, body: JSON.parse(String(options?.body)) });
      return new Promise<Response>(resolve => { release = resolve; });
    });
  };
  const STEPS = ["Checking it's a safe, small change", 'Designing your experiment', 'Forecasting what might happen'];
  async function waiting() {
    await openAsk(); hold();
    typeQuestion();
    await act(async () => { fireEvent.press(design()); });
    await screen.findByRole('header', { name: 'Planning your experiment.' });
  }

  test('shows the scene, the three steps and one honest line, instead of the form', async () => {
    await waiting();
    expect(screen.getByTestId('planning-scene')).toBeTruthy();
    expect(screen.getByText('Usually 10–20 seconds.')).toBeVisible();
    for (const step of STEPS) expect(screen.getByText(step)).toBeVisible();
    expect(screen.queryByLabelText('Your question or goal')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Design experiment' })).toBeNull();
  });

  test('draws the 10 days: 3 baseline, then 7 test', async () => {
    await waiting();
    expect(screen.getAllByTestId('planning-day-baseline')).toHaveLength(3);
    expect(screen.getAllByTestId('planning-day-test')).toHaveLength(7);
  });

  test('the API has no stages, so no step ever claims to be done', async () => {
    await waiting();
    for (const step of STEPS) expect(screen.getByLabelText(`${step}, in progress`)).toBeTruthy();
    expect(screen.queryAllByTestId('planning-step-done')).toHaveLength(0);
  });

  test('with Reduce Motion the scene is static: every day drawn, nothing pulsing', async () => {
    await waiting(); // The test double reports Reduce Motion on.
    for (const day of screen.getAllByTestId(/^planning-day-/)) expect(StyleSheet.flatten(day.props.style).opacity).toBe(1);
    expect(screen.getByLabelText(`${STEPS[0]}, in progress`)).toBeTruthy();
  });

  test('is display only: rerendering, returning to the foreground and time never ask again', async () => {
    await waiting();
    await act(async () => { listeners.forEach(listener => listener('background')); listeners.forEach(listener => listener('active')); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(count(PROPOSE)).toBe(1);
    await act(async () => { release({ ok: true, status: 200, json: async () => withGuess } as Response); });
    await screen.findByRole('header', { name: 'What do you think will happen?' });
    expect(count(PROPOSE)).toBe(1);
  });

  test('leaving shows the leave sheet; Stay keeps waiting', async () => {
    await waiting();
    await act(async () => { fireEvent.press(within(screen.getByTestId('app-header')).getByRole('button', { name: 'Close' })); });
    expect(await screen.findByText('Leave without saving?')).toBeVisible();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Stay' })); });
    expect(screen.getByRole('header', { name: 'Planning your experiment.' })).toBeVisible();
    await act(async () => { release({ ok: true, status: 200, json: async () => withGuess } as Response); });
    await screen.findByRole('header', { name: 'What do you think will happen?' });
  });

  test('Leave drops the late answer, and the lock holds until it arrives, so nothing is paid for twice', async () => {
    await waiting();
    await act(async () => { fireEvent.press(within(screen.getByTestId('app-header')).getByRole('button', { name: 'Close' })); });
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Leave' })); });
    expect(await screen.findByRole('header', { name: 'Ask a question.' })).toBeVisible();
    typeQuestion('Does tea after lunch change my focus?');
    expect(design()).toBeDisabled();
    await act(async () => { fireEvent.press(design()); });
    expect(count(PROPOSE)).toBe(1);
    await act(async () => { release({ ok: true, status: 200, json: async () => withGuess } as Response); });
    expect(screen.getByRole('header', { name: 'Ask a question.' })).toBeVisible();
    expect(screen.queryByRole('header', { name: 'What do you think will happen?' })).toBeNull();
    await waitFor(() => expect(design()).toBeEnabled());
  });
});
