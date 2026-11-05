import { act, fireEvent, screen } from '@testing-library/react-native';

export const pressNext = async () => {
  const next = await screen.findByRole('button', { name: 'Next' });
  await act(async () => { fireEvent.press(next); });
};

/** Walks a designed plan to its last step, entering a guess if one is asked for. */
export async function toStart(guess = '10') {
  await screen.findByRole('button', { name: 'Next' });
  for (let step = 0; step < 5; step++) {
    if (screen.queryByRole('button', { name: 'Start this experiment' })) return;
    const input = screen.queryByLabelText(/^Your guess for/);
    if (input) {
      fireEvent.changeText(input, guess);
      await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Show prediction' })); });
    } else await pressNext();
  }
}
