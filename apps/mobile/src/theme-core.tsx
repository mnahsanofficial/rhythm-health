import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { themeColors, type ThemeName } from '@rhythm-health/brand';

export type ThemeChoice = ThemeName | 'system';
type Colors = ReturnType<typeof themeColors>;

/** Kept per device, like the session. Expo web preview has no secure store, so it lasts until reload there. */
export const THEME_KEY = 'rhythm-theme';
const PALETTES: Record<ThemeName, Colors> = { light: themeColors('light'), dark: themeColors('dark') };

type Theme = { scheme: ThemeName; choice: ThemeChoice; saveFailed: boolean; choose: (choice: ThemeChoice) => void };
/** Light with no provider, so a screen rendered on its own still has every colour. */
const ThemeContext = createContext<Theme>({ scheme: 'light', choice: 'system', saveFailed: false, choose: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [saveFailed, setSaveFailed] = useState(false);
  const chosen = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    SecureStore.getItemAsync(THEME_KEY).then(saved => {
      // A tap made while this was loading is newer than what's stored.
      if (!cancelled && !chosen.current && (saved === 'light' || saved === 'dark')) setChoice(saved);
    }).catch(() => undefined); // Unreadable means no saved choice: the app follows the system.
    return () => { cancelled = true; };
  }, []);

  // Native parts we don't draw (date picker, keyboard, alerts) follow this.
  useEffect(() => { Appearance.setColorScheme?.(choice === 'system' ? 'unspecified' : choice); }, [choice]);

  const choose = useCallback((next: ThemeChoice) => {
    chosen.current = true;
    setChoice(next);
    setSaveFailed(false);
    if (Platform.OS === 'web') return;
    const saved = next === 'system' ? SecureStore.deleteItemAsync(THEME_KEY) : SecureStore.setItemAsync(THEME_KEY, next);
    saved.catch(() => setSaveFailed(true));
  }, []);

  const scheme: ThemeName = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  const value = useMemo(() => ({ scheme, choice, saveFailed, choose }), [scheme, choice, saveFailed, choose]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
export function useColors() { return PALETTES[useContext(ThemeContext).scheme]; }

/** A stylesheet for each mode, built once. Use the returned hook inside a component. */
export function themedStyles<T>(build: (colors: Colors, mode: ThemeName) => T) {
  const built: Partial<Record<ThemeName, T>> = {};
  const forMode = (mode: ThemeName): T => (built[mode] ??= build(PALETTES[mode], mode));
  /** `forMode` is for another stylesheet that builds on this one. */
  return Object.assign(function useThemedStyles(): T { return forMode(useContext(ThemeContext).scheme); }, { forMode });
}
