import { StyleSheet, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

export const STEP_NAMES = ['Age', 'Sleep', 'Hours', 'Move', 'Goals', 'Habits', 'Limits'];

/** Where you are in setup. Each part of your rhythm has a name, so the end is never a surprise. */
export function StepRail({ current }: { current: number }) {
  const local = useLocal();
  const total = STEP_NAMES.length;
  return <View style={{ gap: SPACING.sm }}>
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{ min: 1, max: total, now: current, text: `Question ${current} of ${total}` }} style={local.segments}>
      {STEP_NAMES.map((name, index) => <View key={name} style={[local.segment, index < current && local.done]} />)}
    </View>
    <Copy style={local.label}>{`Question ${current} of ${total} · ${STEP_NAMES[current - 1]}`}</Copy>
  </View>;
}

/** The shape of every experiment, drawn: normal days, then test days. */
export function DayRail() {
  const local = useLocal(); const styles = useStyles();
  const description = '3 normal days, then 7 test days';
  return <View accessible accessibilityRole="image" accessibilityLabel={description} style={{ gap: SPACING.sm }}>
    <View style={local.days}>
      {Array.from({ length: 10 }, (_, day) => <View key={day} style={[local.day, day < 3 ? local.normal : local.test]} />)}
    </View>
    <Copy accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.muted}>{description}</Copy>
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  segments: { flexDirection: 'row', gap: SPACING.xs + 2 },
  segment: { flex: 1, height: SPACING.xs + 2, borderRadius: RADII.pill, backgroundColor: COLORS.border },
  done: { backgroundColor: COLORS.accent },
  label: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  days: { flexDirection: 'row', gap: SPACING.xs + 2 },
  day: { flex: 1, aspectRatio: 1, maxWidth: LAYOUT.tapTarget, borderRadius: RADII.pill },
  normal: { backgroundColor: COLORS['chart-1'] },
  test: { backgroundColor: COLORS['chart-2'] },
}));
