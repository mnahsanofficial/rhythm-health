import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { THEMES } from '@rhythm-health/brand';
import { ThemeControl, ThemeCycleButton, ThemeProvider, THEME_KEY } from '../src/theme';
import { Copy } from '../src/ui';

let mockSystemScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockSystemScheme }));

const app = () => <ThemeProvider><Copy testID="words">Hello</Copy><ThemeControl /></ThemeProvider>;
const textColor = () => StyleSheet.flatten(screen.getByTestId('words').props.style).color;
const system = (scheme: 'light' | 'dark') => { mockSystemScheme = scheme; };

describe('mobile theme', () => {
  test('without a provider, screens render in light, as tests and old surfaces expect', () => {
    render(<Copy testID="words">Hello</Copy>);
    expect(textColor()).toBe(THEMES.light.text);
  });

  test('follows the system by default', async () => {
    system('dark');
    render(app());
    await waitFor(() => expect(textColor()).toBe(THEMES.dark.text));
    expect(screen.getByRole('radio', { name: 'System' }).props.accessibilityState.checked).toBe(true);
  });

  test('a choice applies straight away and is remembered on this device', async () => {
    system('light');
    render(app());
    await act(async () => { fireEvent.press(screen.getByRole('radio', { name: 'Dark' })); });
    expect(textColor()).toBe(THEMES.dark.text);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(THEME_KEY, 'dark');
  });

  test('a remembered choice beats the system on the next launch', async () => {
    system('light');
    await SecureStore.setItemAsync(THEME_KEY, 'dark');
    render(app());
    await waitFor(() => expect(textColor()).toBe(THEMES.dark.text));
  });

  test('a saved value it does not recognise falls back to the system', async () => {
    system('light');
    await SecureStore.setItemAsync(THEME_KEY, 'sepia');
    render(app());
    await waitFor(() => expect(screen.getByRole('radio', { name: 'System' }).props.accessibilityState.checked).toBe(true));
    expect(textColor()).toBe(THEMES.light.text);
  });

  test('a storage failure leaves the app working and the choice applied', async () => {
    system('light');
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('no keychain'));
    render(app());
    await act(async () => { fireEvent.press(screen.getByRole('radio', { name: 'Dark' })); });
    expect(textColor()).toBe(THEMES.dark.text);
  });

  test('the header button moves through the three choices and says where it is', async () => {
    system('light');
    render(<ThemeProvider><ThemeCycleButton /></ThemeProvider>);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /System/ })); });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: /Light/ })); });
    expect(screen.getByRole('button', { name: /Dark/ })).toBeTruthy();
  });

  test('the app tells iOS and Android it supports both modes', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')).expo;
    expect(config.userInterfaceStyle).toBe('automatic');
  });
});
