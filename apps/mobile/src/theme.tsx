import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { LAYOUT, MOTION_DURATION_MS, RADII, SPACING } from '@rhythm-health/brand';
import { themedStyles, useColors, useTheme, type ThemeChoice } from './theme-core';
import { Copy, Status } from './ui';

export { ThemeProvider, THEME_KEY, useTheme } from './theme-core';

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Marker({ on }: { on: boolean }) {
  const local = useLocal();
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: MOTION_DURATION_MS.press, reduceMotion: ReduceMotion.System });
  }, [on, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, local.marker, style]} />;
}

/** Light, dark or system, remembered on this device. Follows the system until someone chooses. */
export function ThemeControl() {
  const local = useLocal();
  const { choice, choose, saveFailed } = useTheme();
  return <View style={{ gap: SPACING.sm }}>
    <Copy>Theme</Copy>
    <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={local.group}>
      {CHOICES.map(({ value, label }) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label}
        accessibilityState={{ checked: choice === value }} onPress={() => choose(value)} style={local.choice}>
        <Marker on={choice === value} />
        <Copy>{label}</Copy>
      </Pressable>)}
    </View>
    {saveFailed && <Status style={local.note}>Applied, but this device couldn&apos;t remember it.</Status>}
  </View>;
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const COLORS = useColors();
  const stroke = { stroke: COLORS.muted, strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none' };
  return <Svg width={SPACING.lg - SPACING.xs} height={SPACING.lg - SPACING.xs} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {choice === 'light' && <><Circle cx={10} cy={10} r={3.5} {...stroke} /><Path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" {...stroke} /></>}
    {choice === 'dark' && <Path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" {...stroke} />}
    {choice === 'system' && <><Circle cx={10} cy={10} r={6.5} {...stroke} /><Path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill={COLORS.muted} /></>}
  </Svg>;
}

/** For the header before sign-in, where there's no menu to hold the full control. */
export function ThemeCycleButton() {
  const COLORS = useColors();
  const { choice, choose } = useTheme();
  const index = CHOICES.findIndex(({ value }) => value === choice);
  const next = CHOICES[(index + 1) % CHOICES.length];
  return <Pressable accessibilityRole="button" accessibilityLabel={`Theme: ${CHOICES[index].label}. Change to ${next.label}`} onPress={() => choose(next.value)}
    style={({ pressed }) => [fixed.cycle, pressed && { backgroundColor: COLORS.line }]}>
    <ThemeIcon choice={choice} />
  </Pressable>;
}

const fixed = StyleSheet.create({
  cycle: { minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill },
});
const useLocal = themedStyles(COLORS => StyleSheet.create({
  group: { flexDirection: 'row', gap: SPACING.xs, padding: SPACING.xs, borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.border, backgroundColor: COLORS.background },
  choice: { flex: 1, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill },
  marker: { borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth, borderColor: COLORS.accent, backgroundColor: COLORS['accent-tint'] },
  note: { color: COLORS.muted },
}));
