import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { MOTION_DURATION_MS, THEMES } from '@rhythm-health/brand';
import type { Metric } from '@rhythm-health/contract';
import { CheckinScene } from '../src/checkin-scene';
import { CheckinFlow, type Answer, type CheckinStep } from '../src/checkin-steps';
import { CHECKIN_ADVANCE_MS, sceneFor, sceneLevel } from '../src/lib/checkin-scene';
import { Frame } from '../src/ui';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const scale = (key: string, label: string, extra: Partial<Metric> = {}): Metric => ({ key, label, type: 'scale', min: 1, max: 10, primary: true, min_label: 'Low', max_label: 'High', ...extra });
const typedMetric = (key: string, label: string, type: 'number' | 'duration' = 'duration'): Metric => ({ key, label, type, min: null, max: null, primary: true, min_label: null, max_label: null });
const asStep = (metric: Metric): CheckinStep => ({ key: metric.key, kind: 'metric', metric, caption: 'Day 4 · Test day', day: 4 });
const change = (action: string): CheckinStep => ({ key: 'intervention_completed', kind: 'change', action, caption: 'Day 4 · Test day', day: 4 });

const energy = asStep(scale('morning_energy', 'Morning energy'));
const sleep = asStep(scale('sleep_quality', 'Sleep quality'));
const minutes = asStep(typedMetric('time_to_sleep', 'Time to fall asleep'));
const hidden = { includeHiddenElements: true };
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style) as { opacity?: number; transform?: Record<string, number>[] };
const moved = (id: string, axis: 'translateX' | 'translateY') => style(id).transform?.find(item => axis in item)?.[axis] as number;

const motionOn = () => jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe('choosing a scene', () => {
  test.each([
    ['morning energy', scale('morning_energy', 'Morning energy'), 'sun'],
    ['how alert', scale('alertness', 'How alert you feel'), 'sun'],
    ['energy that mentions sleep', scale('energy_after_sleep', 'Energy after sleep'), 'sun'],
    ['sleep quality', scale('sleep_quality', 'Sleep quality'), 'night'],
    ['restfulness', scale('restfulness', 'Restfulness'), 'night'],
    ['how rested', scale('rested', 'How rested you feel'), 'night'],
    ['time to sleep, in minutes', typedMetric('time_to_sleep', 'Time to fall asleep'), 'moon-arc'],
    ['any duration', typedMetric('walk', 'Walk'), 'moon-arc'],
    ['a typed number in minutes', typedMetric('wind_down', 'Minutes winding down', 'number'), 'moon-arc'],
    ['focus', scale('focus', 'Focus at work'), 'ring'],
    ['mood', scale('mood', 'Evening mood'), 'ring'],
  ])('%s', (_name, metric, kind) => {
    expect(sceneFor({ kind: 'metric', metric }).kind).toBe(kind);
  });

  test.each([
    ['nothing to match', scale('vegetables', 'Vegetables eaten')],
    ['a typed count', typedMetric('breaks', 'Breaks', 'number')],
    ['a word where more is worse, so a bright scene would mislead', scale('afternoon_sleepiness', 'Afternoon sleepiness')],
    ['an energy crash, for the same reason', scale('energy_crash', 'Energy crash')],
    ['stress', scale('stress', 'Stress today')],
  ])('anything else gets the day ring: %s', (_name, metric) => {
    expect(sceneFor({ kind: 'metric', metric }).kind).toBe('days');
  });

  test.each([
    ['Walk for 20 minutes', 'shoe'],
    ['Take the stairs and 5000 steps', 'shoe'],
    ['No caffeine after lunch', 'cup'],
    ['One cup of tea instead', 'cup'],
    ['Open the curtains at sunrise', 'window'],
    ['Ten minutes of morning sunlight', 'window'],
    ['Walk outside at sunrise', 'shoe'],
    ['Phone in another room', 'ring'],
  ])('the change "%s" shows %s', (action, icon) => {
    expect(sceneFor({ kind: 'change', action })).toEqual({ kind: 'change', icon });
  });
});

describe('how far a value moves a scene', () => {
  test('a scale runs from its own minimum to its own maximum', () => {
    expect(sceneLevel(energy, '1')).toBe(0);
    expect(sceneLevel(energy, '10')).toBe(1);
    expect(sceneLevel(asStep(scale('e', 'Energy', { min: 1, max: 5 })), '3')).toBe(0.5);
  });

  test('fewer minutes is further along the arc, and it never leaves the arc', () => {
    expect(sceneLevel(minutes, '0')).toBe(1);
    expect(sceneLevel(minutes, '15')).toBeGreaterThan(sceneLevel(minutes, '45') as number);
    expect(sceneLevel(minutes, '600')).toBe(0);
  });

  test('no answer, or an answer that is not a number yet, moves nothing', () => {
    expect(sceneLevel(energy, undefined)).toBeNull();
    expect(sceneLevel(minutes, '')).toBeNull();
    expect(sceneLevel(minutes, 'lots')).toBeNull();
    expect(sceneLevel(change('Walk'), undefined)).toBeNull();
  });

  test('the change is lit by Yes and by nothing else', () => {
    expect(sceneLevel(change('Walk'), true)).toBe(1);
    expect(sceneLevel(change('Walk'), false)).toBe(0);
  });
});

describe('each scene shows the value', () => {
  test('a low energy keeps the sun near the horizon; a high one raises it and warms the sky', () => {
    const { unmount } = render(<CheckinScene step={energy} value="2" />);
    const low = { y: moved('scene-sun', 'translateY'), warm: style('scene-warm').opacity as number };
    unmount();
    render(<CheckinScene step={energy} value="9" />);
    expect(moved('scene-sun', 'translateY')).toBeLessThan(low.y);
    expect(style('scene-warm').opacity).toBeGreaterThan(low.warm);
  });

  test('better sleep clears the sky and brings out more stars', () => {
    const stars = () => [0, 1, 2, 3].map(tier => style(`scene-stars-${tier}`).opacity as number);
    const { unmount } = render(<CheckinScene step={sleep} value="2" />);
    const low = { stars: stars(), haze: style('scene-haze').opacity as number };
    unmount();
    render(<CheckinScene step={sleep} value="9" />);
    expect(stars().filter(opacity => opacity > 0.5).length).toBeGreaterThan(low.stars.filter(opacity => opacity > 0.5).length);
    expect(style('scene-haze').opacity).toBeLessThan(low.haze);
  });

  test('fewer minutes takes the moon further along its arc', () => {
    const { unmount } = render(<CheckinScene step={minutes} value="45" />);
    const slow = moved('scene-moon', 'translateX');
    unmount();
    render(<CheckinScene step={minutes} value="10" />);
    expect(moved('scene-moon', 'translateX')).toBeGreaterThan(slow);
  });

  test('focus fills the ring and sharpens it', () => {
    const lit = () => screen.getAllByTestId('scene-ring-segment', hidden).filter(node => (StyleSheet.flatten(node.props.style) as { opacity: number }).opacity > 0.5).length;
    const focus = asStep(scale('focus', 'Focus'));
    const { unmount } = render(<CheckinScene step={focus} value="2" />);
    const low = { lit: lit(), blur: style('scene-ring-haze').opacity as number };
    unmount();
    render(<CheckinScene step={focus} value="9" />);
    expect(lit()).toBeGreaterThan(low.lit);
    expect(style('scene-ring-haze').opacity).toBeLessThan(low.blur);
  });

  test('Yes lights the icon; Not today leaves it as it was, with no warning colour', () => {
    const step = change('Walk for 20 minutes');
    const first = render(<CheckinScene step={step} value={true} />);
    expect(style('scene-icon-lit').opacity).toBe(1);
    first.unmount();
    const none = render(<CheckinScene step={step} value={undefined} />);
    const resting = JSON.stringify(none.toJSON());
    none.unmount();
    const no = render(<CheckinScene step={step} value={false} />);
    expect(style('scene-icon-lit').opacity).toBe(0);
    expect(JSON.stringify(no.toJSON())).toBe(resting);
    for (const colour of [THEMES.light.danger, THEMES.dark.danger, THEMES.light.warning]) expect(resting).not.toContain(colour);
  });

  test('the fallback shows 3 normal and 7 test days, with today highlighted', () => {
    const step = asStep(scale('vegetables', 'Vegetables eaten'));
    render(<CheckinScene step={step} value={undefined} />);
    expect(screen.getAllByTestId('scene-day-baseline', hidden)).toHaveLength(3);
    expect(screen.getAllByTestId('scene-day-test', hidden)).toHaveLength(7);
    expect(screen.getByTestId('scene-today-4', hidden)).toBeTruthy();
    expect(screen.queryByTestId('scene-today-5', hidden)).toBeNull();
  });

  test('with no day from the API, no day is highlighted', () => {
    render(<CheckinScene step={{ ...asStep(scale('vegetables', 'Vegetables eaten')), day: null }} value={undefined} />);
    expect(screen.getAllByTestId('scene-day-test', hidden)).toHaveLength(7);
    expect(screen.queryByTestId(/^scene-today-/, hidden)).toBeNull();
  });

  test('is hidden from screen readers', () => {
    render(<CheckinScene step={energy} value="5" />);
    expect(screen.queryByTestId('checkin-scene')).toBeNull();
    expect(screen.getByTestId('checkin-scene', hidden).props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByTestId('checkin-scene', hidden).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('scene motion', () => {
  test('a new value moves the scene with the shared timing, respecting the system setting', () => {
    motionOn();
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = render(<CheckinScene step={energy} value={undefined} />);
    timing.mockClear();
    view.rerender(<CheckinScene step={energy} value="10" />);
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: MOTION_DURATION_MS.response, reduceMotion: Reanimated.ReduceMotion.System }));
  });

  test('with nothing chosen it drifts slowly; a choice stops the drift', () => {
    motionOn();
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    const view = render(<CheckinScene step={energy} value={undefined} />);
    expect(repeat).toHaveBeenCalledTimes(1);
    repeat.mockClear();
    view.rerender(<CheckinScene step={energy} value="7" />);
    expect(repeat).not.toHaveBeenCalled();
  });

  test('an answer already given doesn\'t drift', () => {
    motionOn();
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    render(<CheckinScene step={energy} value="7" />);
    expect(repeat).not.toHaveBeenCalled();
  });

  test('Reduce Motion: no drift, no timing, and the new state is simply there', () => {
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = render(<CheckinScene step={energy} value={undefined} />);
    const neutral = moved('scene-sun', 'translateY');
    view.rerender(<CheckinScene step={energy} value="10" />);
    view.rerender(<CheckinScene step={energy} value="10" />);
    expect(moved('scene-sun', 'translateY')).toBeLessThan(neutral);
    expect(repeat).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });
});

function Flow({ steps, initial = {} }: { steps: CheckinStep[]; initial?: Record<string, Answer> }) {
  const [values, setValues] = useState(initial);
  return <Frame><CheckinFlow steps={steps} values={values} onAnswer={(key, value) => setValues(current => ({ ...current, [key]: value }))} fields={{}} note="" onNote={() => undefined}
    busy={false} offline={false} saveLabel="Save check-in" onSave={() => undefined} /></Frame>;
}
const heading = (name: string) => screen.queryByRole('header', { name });
const tap = (name: string) => { fireEvent.press(screen.getByRole('radio', { name })); };
const wait = (ms: number) => { act(() => { jest.advanceTimersByTime(ms); }); };

describe('the question step', () => {
  test('moves, holds, then goes on: about 700ms, with a light haptic on the tap', () => {
    motionOn(); jest.useFakeTimers();
    const haptic = jest.mocked(Haptics.impactAsync); haptic.mockClear();
    render(<Flow steps={[energy, sleep]} />);
    tap('Morning energy: 9');
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(haptic).toHaveBeenCalledWith('light');
    expect(screen.getByRole('radio', { name: 'Morning energy: 9' })).toBeChecked();
    wait(CHECKIN_ADVANCE_MS - 1);
    expect(heading('Morning energy')).toBeTruthy();
    wait(1);
    expect(heading('Sleep quality')).toBeTruthy();
    expect(CHECKIN_ADVANCE_MS).toBeGreaterThanOrEqual(500);
    expect(CHECKIN_ADVANCE_MS).toBeLessThanOrEqual(900);
  });

  test('a second tap during the hold changes the answer and goes on once, from the new tap', () => {
    motionOn(); jest.useFakeTimers();
    render(<Flow steps={[energy, sleep, minutes]} />);
    tap('Morning energy: 9');
    wait(CHECKIN_ADVANCE_MS - 1);
    tap('Morning energy: 4');
    wait(CHECKIN_ADVANCE_MS - 1);
    expect(screen.getByRole('radio', { name: 'Morning energy: 4' })).toBeChecked();
    wait(1);
    expect(heading('Sleep quality')).toBeTruthy();
    wait(CHECKIN_ADVANCE_MS * 2);
    expect(heading('Sleep quality')).toBeTruthy();
  });

  test('Back during the hold cancels going on', () => {
    motionOn(); jest.useFakeTimers();
    render(<Flow steps={[energy, sleep, minutes]} />);
    tap('Morning energy: 9'); wait(CHECKIN_ADVANCE_MS);
    tap('Sleep quality: 3');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    wait(CHECKIN_ADVANCE_MS * 2);
    expect(heading('Morning energy')).toBeTruthy();
  });

  test('Yes on the change step waits the same way', () => {
    motionOn(); jest.useFakeTimers();
    render(<Flow steps={[change('Walk for 20 minutes'), energy]} />);
    tap('Yes, I made the change');
    wait(CHECKIN_ADVANCE_MS - 1);
    expect(heading('Did you make the change?')).toBeTruthy();
    wait(1);
    expect(heading('Morning energy')).toBeTruthy();
  });

  test('Reduce Motion goes on straight away, still with the haptic', () => {
    const haptic = jest.mocked(Haptics.impactAsync); haptic.mockClear();
    render(<Flow steps={[energy, sleep]} />);
    tap('Morning energy: 9');
    expect(heading('Sleep quality')).toBeTruthy();
    expect(haptic).toHaveBeenCalledTimes(1);
  });

  test('typing a number buzzes nothing and goes on only by Next', () => {
    motionOn(); jest.useFakeTimers();
    const haptic = jest.mocked(Haptics.impactAsync); haptic.mockClear();
    render(<Flow steps={[minutes, sleep]} />);
    fireEvent.changeText(screen.getByLabelText('Time to fall asleep, in minutes'), '20');
    wait(CHECKIN_ADVANCE_MS * 2);
    expect(heading('Time to fall asleep')).toBeTruthy();
    expect(haptic).not.toHaveBeenCalled();
  });

  test('Next doesn\'t appear during the hold, so the buttons stay where the thumb is', () => {
    motionOn(); jest.useFakeTimers();
    render(<Flow steps={[energy, sleep]} />);
    tap('Morning energy: 9');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  test('an answer already given keeps Next, for moving on without changing it', () => {
    render(<Flow steps={[energy, sleep]} initial={{ morning_energy: '5' }} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeVisible();
  });

  test('answers and Back are in the bottom area; the question and the scene are not', () => {
    render(<Flow steps={[energy, sleep]} initial={{ morning_energy: '5' }} />);
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    const bottom = within(screen.getByTestId('sticky-footer'));
    expect(bottom.getByRole('radio', { name: 'Sleep quality: 7' })).toBeVisible();
    expect(bottom.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(bottom.queryByRole('header')).toBeNull();
    expect(bottom.queryByText('1 Low · 10 High')).toBeNull();
    expect(bottom.queryByText('Day 4 · Test day')).toBeNull();
    expect(bottom.queryByTestId('checkin-scene', hidden)).toBeNull();
    expect(screen.getByText('1 Low · 10 High')).toBeVisible();
    expect(screen.getByTestId('checkin-scene', hidden)).toBeTruthy();
  });

  test('the change step\'s Yes and Not today are in the bottom area too', () => {
    render(<Flow steps={[change('Walk for 20 minutes'), energy]} />);
    const bottom = within(screen.getByTestId('sticky-footer'));
    expect(bottom.getByRole('radio', { name: 'Yes, I made the change' })).toBeVisible();
    expect(bottom.getByRole('radio', { name: 'Not today' })).toBeVisible();
  });

  test('the review has a calm scene of the days, and no answer moves it', () => {
    render(<Flow steps={[energy]} />);
    tap('Morning energy: 7');
    expect(heading('Review')).toBeTruthy();
    expect(screen.getAllByTestId('scene-day-baseline', hidden)).toHaveLength(3);
    expect(screen.queryByTestId('scene-sun', hidden)).toBeNull();
  });
});
