import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { FONT_FAMILIES } from '@rhythm-health/brand';
import type { Experiment, Metric, TodayCheckin } from '@rhythm-health/contract';
import { MobileApp } from '../src/mobile-app';
import { sceneFor } from '../src/lib/checkin-scene';
import { metricValue } from '../src/lib/short-labels';
import { PlanRing } from '../src/plan-ring';
import { experiment, labReport, profile, proposeResponse, writtenLabReport } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('../src/lib/supabase', () => ({ createAuthClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const ENERGY_QUESTION = 'How energetic do you feel about 1 hour after waking?';
const FOCUS_QUESTION = 'How focused do you feel in the first 2 hours of work?';
const ASLEEP_QUESTION = 'About how many minutes did it take you to fall asleep?';
const QUESTIONS = [ENERGY_QUESTION, FOCUS_QUESTION, ASLEEP_QUESTION];
const LONG_ACTION = 'Walk 5 km at a comfortable steady pace (not intense). Keep everything else the same, including your usual workout, coffee and sleep schedule.';
const scale = { type: 'scale', min: 1, max: 10, min_label: 'Drained', max_label: 'Full of energy' } as const;
const metrics: Metric[] = [
  { key: 'morning_energy', label: ENERGY_QUESTION, short_label: 'Morning energy', unit: '/10', primary: true, ...scale },
  { key: 'focus', label: FOCUS_QUESTION, short_label: 'Focus', unit: '/10', primary: false, ...scale },
  { key: 'time_to_fall_asleep', label: ASLEEP_QUESTION, short_label: 'Minutes to fall asleep', unit: 'min', type: 'number', min: null, max: null, min_label: null, max_label: null, primary: false },
] as Metric[];
const intervention = { action: LONG_ACTION, timing: 'Evening', frequency: 'Daily', change_short: 'Walk 5 km after dinner', short_name: 'Evening walk' };
const proposal = { ...proposeResponse.proposal!, question: 'Daily 5 km walk is helpful?', intervention, metrics };
const on = (day: number, phase: 'baseline' | 'intervention', extra: Partial<Experiment> = {}): Experiment => ({
  ...experiment, status: 'active', metrics: metrics as Experiment['metrics'], intervention, question: 'Does having one cup of coffee about 8 hours before bedtime change how long it takes me to fall asleep?', ...extra,
  progress: { ...experiment.progress, state: 'in_progress', day_number: day, total_days: 10, days_remaining: 10 - day, phase, phase_day: phase === 'baseline' ? day : day - 3, phase_days: phase === 'baseline' ? 3 : 7, started_at: '2026-10-01T09:00:00Z' },
});
const example = {
  question: 'Does a 20-minute walk after dinner improve my morning energy?',
  metrics: ['Morning energy', 'Sleep quality'].map((label, index) => ({
    key: label, label, short_label: label, unit: '/10', type: 'scale', normal_change: null,
    runs: [{ experiment_id: 'example', short_name: 'Walk after dinner', question: 'Does a 20-minute walk after dinner improve my morning energy?', completed_at: null, baseline_mean: 5.7 + index * 0.6, result_mean: 6.3 + index * 0.4, percent_change: 11 - index * 5 }],
  })),
};
let routes: Record<string, unknown>;

function install(list: Experiment[], recorded: number[] = [], saved: Record<string, unknown> = {}) {
  routes = {
    'GET /api/profile': profile, 'GET /api/experiments?status=active': list, 'GET /api/experiments?status=completed': [labReport.experiment],
    'GET /api/experiments/progress-summary': { metrics: [], kept: [], example },
    'GET /api/experiments/calibration': { points: [], trend: null, average_off_by_points: null, example: null },
    'POST /api/experiments/propose': { ...proposeResponse, proposal, personal_guess_available: true, prediction: { ...proposeResponse.prediction!, expected_change_min: 2, expected_change_max: 10, confidence: 'low' } },
    'GET /api/experiments/capacity': { active: list.length, limit: 3, can_start: list.length < 3 },
    [`GET /api/experiments/${labReport.experiment.id}/report`]: writtenLabReport,
  };
  for (const item of list) {
    routes[`GET /api/experiments/${item.id}/progress`] = timelineFixture(item, { recorded, nextDayAt: '2026-11-07T18:00:00Z' });
    routes[`GET /api/experiments/${item.id}/checkins`] = recorded.map(day => ({ id: `c${day}`, experiment_id: item.id, day_number: day, phase: 'baseline', intervention_completed: false, metric_values: saved, note: null, created_at: '2026-10-31T10:00:00Z', updated_at: '2026-10-31T10:00:00Z' }));
  }
}

beforeEach(() => {
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'fake', user: { id: 'u', email: 'a@example.invalid' } } }, error: null });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  global.fetch = jest.fn(async (url, options) => {
    const parsed = new URL(String(url)); const method = options?.method ?? 'GET';
    const body = routes[`${method} ${parsed.pathname}${parsed.search}`] ?? routes[`${method} ${parsed.pathname}`];
    if (body === undefined) throw new Error(`Unexpected fake request ${method} ${parsed.pathname}`);
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});
afterEach(() => jest.restoreAllMocks());

const hidden = { includeHiddenElements: true };
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
const press = async (node: Parameters<typeof fireEvent.press>[0]) => { await act(async () => { fireEvent.press(node); }); await settle(); };
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const tab = async (name: string) => press(await screen.findByRole('tab', { name }));
const flatten = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, number | string | undefined>;
const percent = (value: unknown) => parseFloat(String(value));

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
const textOf = (node: Node): string => (node.children ?? []).map(child => typeof child === 'string' ? child : textOf(child)).join('');
function textNodes(tree: unknown, out: Node[] = []): Node[] {
  if (!tree || typeof tree === 'string') return out;
  if (Array.isArray(tree)) { tree.forEach(node => textNodes(node, out)); return out; }
  const node = tree as Node;
  if (node.type === 'Text') { out.push(node); return out; }
  (node.children ?? []).forEach(child => textNodes(child, out));
  return out;
}
const headings = (tree: unknown) => textNodes(tree).filter(node => node.props.accessibilityRole === 'header');
/** What fits on one line at 390 wide, at each heading size: the Fraunces average, measured from the iPhone screenshots. */
const LINE = 40;
function expectOneLineHeadings(tree: unknown) {
  for (const heading of headings(tree)) {
    const text = textOf(heading);
    expect(QUESTIONS).not.toContain(text);
    expect(text.length).toBeLessThanOrEqual(LINE);
    expect(heading.props.numberOfLines).toBe(1);
  }
}
function expectNoMonoSentences(tree: unknown) {
  for (const node of textNodes(tree)) {
    if (flatten(node).fontFamily !== FONT_FAMILIES.mono) continue;
    expect(textOf(node).split(/\s+/).filter(word => /\p{L}{2,}/u.test(word) && !/^(min|to)$/.test(word))).toEqual([]);
  }
}
function expectDecorativeScene(id: string) {
  const scene = screen.getByTestId(id, hidden);
  expect(scene.props.accessibilityElementsHidden).toBe(true);
  expect(scene.props.importantForAccessibility).toBe('no-hide-descendants');
}

async function openPlan() {
  install([]); const view = render(<MobileApp />); await tab('Ask'); await settle();
  fireEvent.changeText(screen.getByLabelText('Your question or goal'), proposal.question);
  await press(button('Design experiment')); await settle();
  return view;
}
const toGuess = async () => { const view = await openPlan(); await press(button('Next')); return view; };
const toReveal = async (guess = '10') => {
  const view = await toGuess();
  fireEvent.changeText(screen.getByLabelText(/^Your guess for/), guess);
  await press(button('Show prediction')); await settle();
  return view;
};

describe('the change step', () => {
  test('the heading is the short change, and the rest is under Details', async () => {
    const view = await openPlan();
    expect(screen.getByRole('header', { name: 'Walk 5 km after dinner' })).toBeTruthy();
    expect(screen.queryByText(LONG_ACTION)).toBeNull();
    await press(button('Details'));
    expect(screen.getByText(LONG_ACTION)).toBeTruthy();
    await press(button('Done'));
    expectOneLineHeadings(view.toJSON());
  });

  test('"Ask something else" is a small text link', async () => {
    await openPlan();
    expect(flatten(button('Ask something else')).borderWidth).toBeUndefined();
    expect(flatten(button('Ask something else')).backgroundColor).toBeUndefined();
  });

  test('a decorative scene for the change fills the space', async () => {
    await openPlan();
    expectDecorativeScene('checkin-scene');
    expect(flatten(screen.getByTestId('checkin-scene', hidden)).flexGrow).toBe(1);
  });
});

describe('the scene for a change', () => {
  test.each([
    ['Walk 5 km after dinner', 'shoe'], ['Have one cup of coffee about 8 hours before bedtime', 'cup'],
    ['Get 10 minutes of outdoor daylight', 'window'], ['Go to bed 30 minutes earlier', 'moon'], ['Wind down before sleep', 'moon'], ['Eat more vegetables', 'ring'],
  ])('%s', (action, icon) => {
    expect(sceneFor({ kind: 'change', action })).toEqual({ kind: 'change', icon });
  });
});

describe('the guess step', () => {
  test('says what is being guessed in short words', async () => {
    const view = await toGuess();
    expect(screen.getByRole('header', { name: 'Your guess' })).toBeTruthy();
    expect(screen.getByText('Morning energy, % change from normal')).toBeTruthy();
    expect(screen.queryByText(new RegExp(ENERGY_QUESTION.slice(0, 20)))).toBeNull();
    expectDecorativeScene('checkin-scene');
    expectOneLineHeadings(view.toJSON());
  });

  test('− and + move the guess by 5, within its limits', async () => {
    await toGuess();
    const input = screen.getByLabelText(/^Your guess for/);
    await press(button('Raise guess by 5'));
    expect(input.props.value).toBe('5');
    await press(button('Lower guess by 5')); await press(button('Lower guess by 5'));
    expect(input.props.value).toBe('-5');
    fireEvent.changeText(input, '198');
    await press(button('Raise guess by 5'));
    expect(input.props.value).toBe('200');
    fireEvent.changeText(input, '-98');
    await press(button('Lower guess by 5'));
    expect(input.props.value).toBe('-100');
  });

  test('the bar runs from -100 to +200 and moves as you type', async () => {
    await toGuess();
    expect(screen.getByText('-100%')).toBeTruthy();
    expect(screen.getByText('+200%')).toBeTruthy();
    expect(screen.queryByTestId('change-bar-fill')).toBeNull();
    fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '50');
    const zero = 100 / 3;
    let fill = flatten(screen.getByTestId('change-bar-fill'));
    expect(percent(fill.left)).toBeCloseTo(zero, 1);
    expect(percent(fill.width)).toBeCloseTo(50 / 3, 1);
    fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '-100');
    fill = flatten(screen.getByTestId('change-bar-fill'));
    expect(percent(fill.left)).toBeCloseTo(0, 1);
    expect(percent(fill.width)).toBeCloseTo(zero, 1);
  });
});

describe('the reveal', () => {
  test('the sentence is the short label and a direction', async () => {
    const view = await toReveal();
    expect(screen.getByRole('header', { name: 'Morning energy is likely to go up' })).toBeTruthy();
    expectOneLineHeadings(view.toJSON());
    expectNoMonoSentences(view.toJSON());
  });

  test('the guess is a marker on the same bar as the predicted range', async () => {
    await toReveal('10');
    const marker = flatten(screen.getByTestId('guess-marker', hidden));
    const range = flatten(screen.getByTestId('change-bar-fill', hidden));
    expect(percent(marker.left)).toBeCloseTo(100, 1); // +10 on a scale of -10 to +10, the far end of the range.
    expect(percent(range.left)).toBeCloseTo(60, 1);
    expect(percent(range.width)).toBeCloseTo(40, 1);
  });

  test('a guess outside the range widens the bar, so it still shows', async () => {
    await toReveal('-50');
    expect(screen.getAllByText('-50%').length).toBe(2); // The guess, and the end of the bar.
    expect(screen.getByText('+50%')).toBeTruthy();
    expect(percent(flatten(screen.getByTestId('guess-marker', hidden)).left)).toBeCloseTo(0, 1);
  });

  test('confidence is in the body font, and a scene follows', async () => {
    await toReveal();
    expect(flatten(screen.getByText('Confidence: Low')).fontFamily).toBe(FONT_FAMILIES.sans);
    expectDecorativeScene('checkin-scene');
  });
});

describe('your 10 days', () => {
  test('a ring of 3 normal and 7 test days, with the sun at day 1', async () => {
    const view = await toReveal();
    await press(button('Next'));
    expect(screen.getByRole('header', { name: 'Your 10 days' })).toBeTruthy();
    expectDecorativeScene('plan-ring');
    expect(screen.getAllByTestId('plan-ring-baseline', hidden)).toHaveLength(3);
    expect(screen.getAllByTestId('plan-ring-test', hidden)).toHaveLength(7);
    expect(screen.getByTestId('plan-ring-sun', hidden)).toBeTruthy();
    expectOneLineHeadings(view.toJSON());
  });

  test('the ring draws the days the plan has, not a fixed 3 and 7', () => {
    render(<PlanRing baselineDays={5} testDays={9} />);
    expect(screen.getAllByTestId('plan-ring-baseline', hidden)).toHaveLength(5);
    expect(screen.getAllByTestId('plan-ring-test', hidden)).toHaveLength(9);
  });

  test('it is still with Reduce Motion', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    render(<PlanRing baselineDays={3} testDays={7} />);
    for (const day of screen.getAllByTestId('plan-ring-test', hidden)) expect(flatten(day).opacity).toBe(1);
  });
});

describe('a value and its unit', () => {
  test.each([
    [metrics[0], '10', '10/10'], [metrics[2], '90', '90 min'],
    [{ ...metrics[2], unit: null }, '4', '4'], [{ ...metrics[2], type: 'boolean', unit: null }, true, 'Yes'], [{ ...metrics[2], type: 'boolean', unit: null }, false, 'No'],
  ])('%#', (metric, value, shown) => {
    expect(metricValue(metric as Metric, value as string | boolean)).toBe(shown);
  });
});

const editing = { morning_energy: 10, focus: 10, time_to_fall_asleep: 90 };
async function toReview() {
  install([on(1, 'baseline')], [1], editing);
  const view = render(<MobileApp />); await settle(); await settle();
  await press(screen.getByRole('button', { name: /Change today|Edit|Update/ }));
  await settle();
  return view;
}

describe('every check-in page', () => {
  const checkinButton = () => screen.getByRole('button', { name: /^Check in now, day/ });

  test('a new check-in shows a scene and a short heading on every step, the change and a typed number included', async () => {
    install([on(4, 'intervention')], [1, 2, 3]);
    const view = render(<MobileApp />); await settle(); await settle();
    await press(checkinButton()); await settle();
    expect(screen.getByRole('header', { name: 'Did you make the change?' })).toBeTruthy();
    expect(screen.getByText('Walk 5 km after dinner')).toBeTruthy();
    expect(screen.queryByText(LONG_ACTION)).toBeNull();
    expectDecorativeScene('checkin-scene');
    await press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
    for (const [title, question] of [['Morning energy', ENERGY_QUESTION], ['Focus', FOCUS_QUESTION]]) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
      expect(screen.getByText(question)).toBeTruthy();
      expectDecorativeScene('checkin-scene');
      expectOneLineHeadings(view.toJSON());
      await press(screen.getByRole('radio', { name: `${title}: 7` }));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
    }
    expect(screen.getByRole('header', { name: 'Minutes to fall asleep' })).toBeTruthy();
    expectDecorativeScene('checkin-scene');
    expectOneLineHeadings(view.toJSON());
  });

  test('editing today shows a scene on every step too, then a review of short rows with units', async () => {
    const view = await toReview();
    for (const title of ['Morning energy', 'Focus', 'Minutes to fall asleep']) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
      expectDecorativeScene('checkin-scene');
      await press(button('Next'));
    }
    expect(screen.getByRole('header', { name: 'Review' })).toBeTruthy();
    expect(screen.getByText('Morning energy')).toBeTruthy();
    expect(screen.getAllByText('10/10')).toHaveLength(2);
    expect(screen.getByText('Minutes to fall asleep')).toBeTruthy();
    expect(screen.getByText('90 min')).toBeTruthy();
    for (const question of QUESTIONS) expect(screen.queryByText(question)).toBeNull();
    expectDecorativeScene('checkin-scene');
    expectOneLineHeadings(view.toJSON());
    expectNoMonoSentences(view.toJSON());
  });

  test('a combined check-in names each experiment and its change in short words', async () => {
    const a = on(2, 'baseline', { id: 'first-id' });
    const b = on(5, 'intervention', { id: 'second-id' });
    install([a, b]);
    routes['GET /api/checkins/today'] = {
      revision: 'r', note: null, all_recorded: false,
      experiments: [
        { id: 'first-id', question: a.question, action: 'Get daylight', change_short: 'Get daylight', short_name: 'Morning light', timing: 'Morning', day_number: 2, total_days: 10, phase: 'baseline', change_required: false, change_made: null, recorded: false },
        { id: 'second-id', question: b.question, action: LONG_ACTION, change_short: 'Walk 5 km after dinner', short_name: 'Evening walk', timing: 'Evening', day_number: 5, total_days: 10, phase: 'intervention', change_required: true, change_made: null, recorded: false },
      ],
      questions: [{ id: 'q0', experiment_ids: ['first-id'], value: null, metric: metrics[0] }, { id: 'q1', experiment_ids: ['second-id'], value: null, metric: metrics[2] }],
    } as unknown as TodayCheckin;
    render(<MobileApp />); await settle(); await settle();
    await press(screen.getAllByRole('button', { name: /^Check in now, day/ })[0]); await settle();
    expect(screen.getByText('Morning light')).toBeTruthy();
    expectDecorativeScene('checkin-scene');
    await press(screen.getByRole('radio', { name: 'Morning energy: 7' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
    expect(screen.getByText('Evening walk')).toBeTruthy();
    expect(screen.queryByText(LONG_ACTION)).toBeNull();
    expectDecorativeScene('checkin-scene');
    await press(screen.getByRole('radio', { name: 'Yes, I made the change' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
    expectDecorativeScene('checkin-scene');
    expect(screen.getByRole('header', { name: 'Minutes to fall asleep' })).toBeTruthy();
  });
});

describe('Progress', () => {
  const open = async (recorded = [1]) => {
    install([on(1, 'baseline')], recorded, editing); const view = render(<MobileApp />); await settle(); await settle();
    await tab('Progress'); await settle(); await settle();
    return view;
  };

  test('the Example shows its question once and a one-line row per metric', async () => {
    await open();
    const card = within(screen.getByTestId('progress-example'));
    expect(card.getAllByText(example.question)).toHaveLength(1);
    expect(card.getByText('Morning energy')).toBeTruthy();
    expect(card.getByText('5.7 → 6.3')).toBeTruthy();
    expect(card.getByText('+11%')).toBeTruthy();
    expect(card.queryByText(/with the change/)).toBeNull();
  });

  test('"trends, not proof" is a caption inside the Example', async () => {
    await open();
    expect(within(screen.getByTestId('progress-example')).getByText(/trends, not proof/)).toBeTruthy();
    expect(screen.getAllByText(/trends, not proof/)).toHaveLength(1);
  });

  test('a running experiment is a short heading, a row of small dots and a count in the body font', async () => {
    const view = await open();
    const question = on(1, 'baseline').question;
    expect(screen.getByRole('header', { name: 'Evening walk' })).toBeTruthy();
    expect(screen.queryByText(question)).toBeNull();
    expect(flatten(screen.getByText('1/10')).fontFamily).toBe(FONT_FAMILIES.sans);
    const row = screen.getByTestId('day-dots');
    expect(flatten(row).flexDirection).toBe('row');
    expect(flatten(row).flexWrap).toBeUndefined();
    expect(screen.getAllByTestId('day-dot', hidden)).toHaveLength(10);
    for (const dot of screen.getAllByTestId('day-dot', hidden)) expect(flatten(dot).width).toBeLessThanOrEqual(16);
    expectNoMonoSentences(view.toJSON());
  });

  test('the full question is one tap away', async () => {
    await open();
    await press(button('The question'));
    expect(screen.getByText(on(1, 'baseline').question)).toBeTruthy();
  });

  test('every day keeps a spoken name', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Day 1, baseline, logged' })).toBeTruthy();
    expect(screen.getByLabelText('Day 2, baseline, upcoming')).toBeTruthy();
    expect(screen.getByLabelText('1 of 10 days recorded')).toBeTruthy();
  });
});

describe('no screen uses a metric\'s full question as a heading', () => {
  test('the Lab Report and the experiment screen use the short label too', async () => {
    const long = { ...writtenLabReport, experiment: { ...writtenLabReport.experiment, metrics: writtenLabReport.experiment.metrics.map(metric => metric.primary ? { ...metric, short_label: 'Morning energy' } : metric) },
      analysis: { ...writtenLabReport.analysis, metrics: writtenLabReport.analysis.metrics.map(metric => metric.primary ? { ...metric, label: ENERGY_QUESTION } : metric) } };
    install([on(4, 'intervention')], [1, 2, 3]);
    routes[`GET /api/experiments/${labReport.experiment.id}/report`] = long;
    const view = render(<MobileApp />); await settle(); await settle();
    await press(button('See your experiment'));
    await press(button('Not now')).catch(() => undefined);
    for (const heading of headings(view.toJSON())) expect(textOf(heading)).not.toContain(ENERGY_QUESTION);
    await tab('History'); await settle(); await settle();
    await press(screen.getByRole('button', { name: `Open Lab Report for ${labReport.experiment.question}` })); await settle();
    expect(screen.queryByText(new RegExp(ENERGY_QUESTION.slice(0, 20)))).toBeNull();
    for (const heading of headings(view.toJSON())) expect(textOf(heading)).not.toContain(ENERGY_QUESTION);
  });
});
