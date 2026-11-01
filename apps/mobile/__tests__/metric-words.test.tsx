import { fireEvent, render, screen } from '@testing-library/react-native';
import { MetricInput } from '../src/metric-input';
import { proposal } from '../../../frontend/tests/support/fixtures';

test('uses backend scale words and sends numeric choices unchanged', () => {
  const onChange = jest.fn();
  render(<MetricInput metric={{ ...proposal.metrics[0], min: 2, max: 6, min_label: 'Very tired', max_label: 'Ready for the day' }} value={undefined} onChange={onChange} disabled={false} />);
  expect(screen.getByText('2 Very tired · 6 Ready for the day')).toBeVisible();
  fireEvent.press(screen.getByRole('radio', { name: 'Morning energy: 6' }));
  expect(onChange).toHaveBeenCalledWith('6');
});

test('old known scales fall back to Low / High, without guessing endpoint meanings', () => {
  render(<MetricInput metric={proposal.metrics[0]} value={undefined} onChange={jest.fn()} disabled={false} />);
  expect(screen.getByText('1 Low · 10 High')).toBeVisible();
});
