import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import type { Metric } from '@rhythm-health/contract';
import { CheckinFlow, type Answer, type CheckinStep } from '../src/checkin-steps';
import { CHECKIN_ADVANCE_MS } from '../src/lib/checkin-scene';
import { Frame } from '../src/ui';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const scale = (key: string, label: string): Metric => ({ key, label, type: 'scale', min: 1, max: 10, primary: true, min_label: 'Low', max_label: 'High' });
const asStep = (metric: Metric): CheckinStep => ({ key: metric.key, kind: 'metric', metric, caption: 'Day 4 · Test day', day: 4 });
const change: CheckinStep = { key: 'change', kind: 'change', action: 'Walk for 20 minutes', caption: 'Day 4 · Test day', day: 4 };
const energy = asStep(scale('energy', 'Morning energy'));
const sleep = asStep(scale('sleep', 'Sleep quality'));
const focus = asStep(scale('focus', 'Focus'));
const LONG = CHECKIN_ADVANCE_MS * 20;

function Flow({ steps, initial = {}, editing = false }: { steps: CheckinStep[]; initial?: Record<string, Answer>; editing?: boolean }) {
  const [values, setValues] = useState(initial);
  return <Frame><CheckinFlow steps={steps} values={values} editing={editing} onAnswer={(key, value) => setValues(current => ({ ...current, [key]: value }))} fields={{}} note="" onNote={() => undefined}
    busy={false} offline={false} saveLabel="Update check-in" onSave={() => undefined} /></Frame>;
}
const on = (name: string) => screen.queryByRole('header', { name });
const tap = (name: string) => { fireEvent.press(screen.getByRole('radio', { name })); };
const press = (name: string) => { fireEvent.press(screen.getByRole('button', { name })); };
const wait = (ms: number) => { act(() => { jest.advanceTimersByTime(ms); }); };
const checked = (name: string) => expect(screen.getByRole('radio', { name })).toBeChecked();

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe.each([['with motion', false], ['with Reduce Motion', true]])('%s', (_name, reduce) => {
  const hold = reduce ? 0 : CHECKIN_ADVANCE_MS;
  beforeEach(() => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(reduce);
    jest.useFakeTimers();
  });

  describe('a first check-in', () => {
    test('nothing moves on before a tap: not on mount, not on a timer, not from the idle scene', () => {
      render(<Flow steps={[change, energy, sleep]} />);
      wait(LONG);
      expect(on('Did you make the change?')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });

    test('one tap moves on once, after the hold, and the next step then waits for its own tap', () => {
      render(<Flow steps={[energy, sleep, focus]} />);
      tap('Morning energy: 7');
      if (hold) { wait(hold - 1); expect(on('Morning energy')).toBeTruthy(); wait(1); }
      expect(on('Sleep quality')).toBeTruthy();
      wait(LONG);
      expect(on('Sleep quality')).toBeTruthy();
    });
  });

  describe('editing a saved check-in', () => {
    const saved = { energy: '5', sleep: '6', focus: '7' };

    test('prefilled answers don\'t move on: the saved answer is selected, with Next', () => {
      render(<Flow editing steps={[energy, sleep, focus]} initial={saved} />);
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
      checked('Morning energy: 5');
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    test('tapping a value changes it and stays; only Next moves on, by one step', () => {
      render(<Flow editing steps={[energy, sleep, focus]} initial={saved} />);
      tap('Morning energy: 9');
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
      checked('Morning energy: 9');
      press('Next');
      expect(on('Sleep quality')).toBeTruthy();
      wait(LONG);
      expect(on('Sleep quality')).toBeTruthy();
    });

    test('a question with no saved answer waits for Next too', () => {
      render(<Flow editing steps={[energy, sleep]} initial={{ sleep: '6' }} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
      tap('Morning energy: 4');
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    test('the change step waits for Next as well', () => {
      render(<Flow editing steps={[change, energy]} initial={{ change: false, energy: '5' }} />);
      tap('Yes, I made the change');
      wait(LONG);
      expect(on('Did you make the change?')).toBeTruthy();
      press('Next');
      expect(on('Morning energy')).toBeTruthy();
    });
  });

  describe('Back', () => {
    const answerFirst = () => { tap('Morning energy: 7'); wait(hold); expect(on('Sleep quality')).toBeTruthy(); };

    test('to an answered step stays there, with the answer selected and Next', () => {
      render(<Flow steps={[energy, sleep, focus]} />);
      answerFirst();
      press('Back');
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
      checked('Morning energy: 7');
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    test('and changing that answer still waits for Next', () => {
      render(<Flow steps={[energy, sleep, focus]} />);
      answerFirst();
      press('Back');
      tap('Morning energy: 2');
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
      checked('Morning energy: 2');
      press('Next');
      expect(on('Sleep quality')).toBeTruthy();
    });

    test('works while editing, and never moves forward', () => {
      render(<Flow editing steps={[energy, sleep]} initial={{ energy: '5', sleep: '6' }} />);
      press('Next');
      tap('Sleep quality: 8');
      press('Back');
      wait(LONG);
      expect(on('Morning energy')).toBeTruthy();
    });
  });
});

test('Back during the hold cancels moving on', () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
  jest.useFakeTimers();
  render(<Flow steps={[energy, sleep, focus]} />);
  tap('Morning energy: 7'); wait(CHECKIN_ADVANCE_MS);
  tap('Sleep quality: 3');
  press('Back');
  wait(LONG);
  expect(on('Morning energy')).toBeTruthy();
});
