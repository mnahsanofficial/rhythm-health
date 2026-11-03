import { createElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { MobileApp } from '../../src/mobile-app';

export async function openMenu() {
  const button = await screen.findByRole('button', { name: /^Account menu for / });
  await act(async () => { fireEvent.press(button); });
}
/** Opens the account panel and chooses a row, as a person would. */
export async function goTo(name: string) {
  await openMenu();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
}

/** Renders the app and, on the signed-out landing, goes on to the sign-in form. */
export async function renderToForm() {
  const view = render(createElement(MobileApp));
  await act(async () => { await Promise.resolve(); });
  const header = screen.queryByTestId('app-header');
  const signIn = header && within(header).queryByRole('button', { name: 'Sign in' });
  if (signIn) await act(async () => { fireEvent.press(signIn); });
  return view;
}
