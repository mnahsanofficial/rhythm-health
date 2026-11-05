import { fireEvent, render, screen } from '@testing-library/react-native';
import { HowWeKnow } from '../src/how-we-know';
import { visibleLines } from './support/word-budget';

test('opens from one row and says it in at most 5 short lines', () => {
  render(<HowWeKnow />);
  expect(screen.queryByTestId('how-we-know')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'How we know' }));
  const lines = visibleLines(screen.getByTestId('how-we-know').props.children.map((child: { props: { children: string } }) => ({ type: 'Text', props: {}, children: [child.props.children] })));
  expect(lines.length).toBeLessThanOrEqual(5);
  for (const line of lines) expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(16);
});

test('covers baseline vs test, normal ups and downs and overlaps, and promises nothing', () => {
  render(<HowWeKnow />);
  fireEvent.press(screen.getByRole('button', { name: 'How we know' }));
  expect(screen.getByText(/normal days with your test days/)).toBeVisible();
  expect(screen.getByText(/normal ups and downs/)).toBeVisible();
  expect(screen.getByText(/another experiment/)).toBeVisible();
  expect(screen.getByText(/pattern, not proof/)).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/proven|cures?\b|treats?\b|guarantee|will help/i);
});
