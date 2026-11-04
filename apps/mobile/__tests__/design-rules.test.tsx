import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LAYOUT, THEMES } from '@rhythm-health/brand';
import { Action, useStyles } from '../src/ui';
import { DayRail, StepRail, STEP_NAMES } from '../src/rails';

const MODES = ['light', 'dark'] as const;

describe('the rules in docs/design/05-design-system.md', () => {
  test.each(MODES)('actions fit their words and stay at least 48pt high in %s', mode => {
    const { fit, action } = useStyles.forMode(mode);
    expect(fit.alignSelf).toBe('flex-start');
    expect(fit.maxWidth).toBe(LAYOUT.buttonMaxWidth);
    expect(action.minHeight).toBeGreaterThanOrEqual(48);
  });

  test.each(MODES)('the edge of a field or a secondary action is visible in %s', mode => {
    const { input, secondary } = useStyles.forMode(mode);
    expect(input.borderColor).toBe(THEMES[mode].control);
    expect(secondary.borderColor).toBe(THEMES[mode].control);
  });

  test('a disabled action says so without fading its words away', () => {
    render(<Action label="Continue" disabled onPress={() => undefined} />);
    const label = StyleSheet.flatten(screen.getByText('Continue').props.style);
    expect(label.color).toBe(THEMES.light.muted);
  });
});

describe('where you are', () => {
  test('the step rail reports progress and names the current step', () => {
    render(<StepRail current={2} />);
    expect(screen.getByRole('progressbar', { name: 'Setup progress' }).props.accessibilityValue).toMatchObject({ now: 2, max: STEP_NAMES.length });
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('02 / 07')).toBeTruthy();
  });

  test('the day rail says the experiment\'s real shape in words', () => {
    render(<DayRail />);
    expect(screen.getByLabelText('3 normal days, then 7 test days')).toBeTruthy();
  });
});
