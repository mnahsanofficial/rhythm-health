import { act, fireEvent, screen } from '@testing-library/react-native';

export async function openMenu() {
  const button = await screen.findByRole('button', { name: /^Account menu for / });
  await act(async () => { fireEvent.press(button); });
}
/** Opens the account panel and chooses a row, as a person would. */
export async function goTo(name: string) {
  await openMenu();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
}
