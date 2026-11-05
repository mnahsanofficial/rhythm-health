import { fireEvent, render, screen } from '@testing-library/react-native';
import { experiment } from '../../../frontend/tests/support/fixtures';
import { timelineFixture } from '../../../frontend/tests/support/timeline-fixture';
import { TodayDashboard, greeting, weeklyCount } from '../src/today-dashboard';
import type { DayData } from '../src/today';

const entry = (id: string, day = 4, recorded: number[] = []): DayData => {
  const exp = { ...experiment, id, question: 'Same question', status: 'active' as const, progress: { ...experiment.progress, state: 'in_progress' as const, day_number: day, total_days: 10, days_remaining: 10 - day, phase: day <= 3 ? 'baseline' as const : 'intervention' as const, phase_day: day <= 3 ? day : day - 3, phase_days: day <= 3 ? 3 : 7 } };
  return { experiment: exp, timeline: timelineFixture(exp, { recorded, nextDayAt: '2026-11-05T10:00:00Z' }) };
};
const checkin = jest.fn(), detail = jest.fn(), results = jest.fn(), ask = jest.fn(), example = jest.fn();
function show(entries: DayData[]) { return render(<TodayDashboard entries={entries} disabled={false} onCheckin={checkin} onDetail={detail} onResults={results} onAsk={ask} onExample={example} now={new Date(2026, 10, 5, 9)} />); }
beforeEach(() => jest.clearAllMocks());
test.each([[5, 'Good morning.'], [11, 'Good morning.'], [12, 'Good afternoon.'], [17, 'Good afternoon.'], [18, 'Good evening.'], [23, 'Good evening.']])('greeting at %i', (hour, expected) => { expect(greeting(new Date(2026, 10, 5, Number(hour)))).toBe(expected); });
test('uses a first name only when supplied', () => expect(greeting(new Date(2026, 10, 5, 9), '  Sami Ahmed ')).toBe('Morning, Sami.'));
test('counts only recorded days in the server day window, including missed days honestly', () => { expect(weeklyCount(entry('a', 10, [1, 2, 4, 6, 7, 8, 10]))).toBe(5); expect(weeklyCount(entry('a', 2, [1]))).toBe(1); });
test('header and due action use returned boundary', () => { show([entry('a')]); expect(screen.getByText('Thursday, 5 November')).toBeVisible(); expect(screen.getByText('Check-in due · closes Thursday 4:00 PM')).toBeVisible(); fireEvent.press(screen.getByRole('button', { name: 'Check in now, day 4' })); expect(checkin).toHaveBeenCalledWith(expect.objectContaining({ experiment: expect.objectContaining({ id: 'a' }) })); });
test('due priority is check-in, baseline transition, then completed results', () => { const completed = entry('c'); completed.timeline.progress = { ...completed.timeline.progress, state: 'completed' }; show([completed, entry('b', 3, [3]), entry('a')]); expect(screen.getByText(/^Check-in due/)).toBeVisible(); expect(screen.queryByText('Your results are ready')).toBeNull(); });
test('baseline transition outranks ready results', () => { const completed = entry('c'); completed.timeline.progress = { ...completed.timeline.progress, state: 'completed' }; show([completed, entry('b', 3, [3])]); expect(screen.getByText('Baseline done · your test starts tomorrow')).toBeVisible(); });
test('recorded today offers editing with no due card', () => { show([entry('a', 4, [4])]); fireEvent.press(screen.getByRole('button', { name: "Edit today's answers" })); expect(checkin).toHaveBeenCalled(); expect(screen.queryByText(/^Check-in due/)).toBeNull(); });
test('day ten remains due until recorded, then offers results', () => { const view = show([entry('a', 10)]); expect(screen.getByRole('button', { name: 'Check in now, day 10' })).toBeVisible(); view.unmount(); show([entry('a', 10, [10])]); fireEvent.press(screen.getByRole('button', { name: 'See your results' })); expect(results).toHaveBeenCalled(); });
test.each([2, 3])('%i experiments use compact rows keyed by id even with identical names', count => { show(Array.from({ length: count }, (_, i) => entry(`id-${i}`))); expect(screen.getByText('Also running')).toBeVisible(); expect(screen.getAllByTestId(/^also-/)).toHaveLength(count - 1); fireEvent.press(screen.getByTestId('also-id-1')); expect(detail).toHaveBeenCalledWith(expect.objectContaining({ experiment: expect.objectContaining({ id: 'id-1' }) })); });
test('empty hero opens Ask and labels the completed example', () => { show([]); fireEvent.press(screen.getByRole('button', { name: 'Ask your first question' })); expect(ask).toHaveBeenCalled(); fireEvent.press(screen.getByRole('button', { name: 'See a completed example' })); expect(example).toHaveBeenCalled(); });
