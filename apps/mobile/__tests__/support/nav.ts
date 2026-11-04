import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MobileApp } from '../../src/mobile-app';

export async function openMenu() {
  const button = await screen.findByRole('button', { name: /^Account menu for / });
  await act(async () => { fireEvent.press(button); });
}
const press = (node: Parameters<typeof fireEvent.press>[0]) => act(async () => { fireEvent.press(node); });
const ON_YOU: Record<string, string> = { Demo: 'See an example' };

/**
 * Goes where a person would: a tab if it has one, otherwise the row on You.
 * Before a profile exists there are no tabs, so Sign out is in the header's menu.
 */
export async function goTo(name: string) {
  const you = await screen.findByRole('tab', { name: 'You' }).catch(() => null);
  if (!you) {
    await openMenu();
    await press(screen.getByRole('button', { name }));
    return;
  }
  const direct = screen.queryByRole('tab', { name: name === 'Your lab' ? 'Today' : name });
  if (direct) { await press(direct); return; }
  await press(you);
  await press(screen.getByRole('button', { name: ON_YOU[name] ?? name }));
}

/** Renders the app and, on the signed-out landing, goes on to the sign-in form. */
export async function renderToForm() {
  const view = render(createElement(MobileApp));
  await act(async () => { await Promise.resolve(); });
  const signIn = screen.queryByTestId('landing-slides') && screen.queryByRole('button', { name: 'Sign in' });
  if (signIn) await act(async () => { fireEvent.press(signIn); });
  return view;
}
