import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { experiment } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { TodayDashboard } from '../src/today-dashboard';
import type { DayData } from '../src/today';

const entry = (day: number, recorded: number[] = []): DayData => {
  const phase = day <= 3 ? 'baseline' as const : 'intervention' as const;
  const exp = { ...experiment, status: 'active' as const, progress: { ...experiment.progress, state: 'in_progress' as const, day_number: day, total_days: 10, days_remaining: 10 - day, phase, phase_day: day <= 3 ? day : day - 3, phase_days: day <= 3 ? 3 : 7 } };
  return { experiment: exp, timeline: timelineFixture(exp, { recorded, nextDayAt: new Date(2026, 10, 7, 16).toISOString() }) };
};
const show = (entries: DayData[]) => render(<TodayDashboard entries={entries} disabled={false} onCheckin={jest.fn()} onDetail={jest.fn()} onResults={jest.fn()} onAsk={jest.fn()} onExample={jest.fn()} now={new Date(2026, 10, 5, 9)} />);

describe('Today shows state, not sentences', () => {
  test('a recorded day is a check, not the words', () => {
    show([entry(1, [1])]);
    expect(screen.queryByText('Day 1 recorded')).toBeNull();
    expect(screen.getByLabelText('Day 1 recorded')).toBeVisible();
    expect(screen.getByTestId('recorded-check')).toBeVisible();
  });

  test('a day still to do has no check', () => {
    show([entry(4)]);
    expect(screen.queryByTestId('recorded-check')).toBeNull();
    expect(screen.getByText('Closes Saturday 4:00 PM')).toBeVisible();
  });

  test('the small change is one row, and its words wait behind it', () => {
    show([entry(4)]);
    expect(screen.queryByText(experiment.intervention.action)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: "Today's change" }));
    expect(screen.getByText(experiment.intervention.action)).toBeVisible();
    expect(screen.getByText(`${experiment.intervention.timing} · ${experiment.intervention.frequency}`)).toBeVisible();
  });

  test('on a normal day the row says it is the change to come, and when', () => {
    show([entry(1)]);
    fireEvent.press(screen.getByRole('button', { name: 'The change' }));
    expect(screen.getByText('Starts on day 4. Keep your routine until then.')).toBeVisible();
  });

  test('no greeting date, due card or second action competes with the next action', () => {
    show([entry(4)]);
    expect(screen.queryByText('Thursday, 5 November')).toBeNull();
    expect(screen.queryByText(/^Check-in due/)).toBeNull();
    const card = screen.getByTestId('today-card');
    expect(within(card).getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual(['See your experiment', "Today's change", 'Check in now, day 4']);
  });
});

