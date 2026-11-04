import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

export const STEP_NAMES = ['Age', 'Sleep', 'Hours', 'Move', 'Goals', 'Habits', 'Limits'];

/** Where you are in setup. It fills smoothly, and each part of your rhythm has a name, so the end is never a surprise. */
export function StepRail({ current }: { current: number }) {
  const local = useLocal();
  const total = STEP_NAMES.length;
  const done = Math.min(current, total);
  const reduce = useReducedMotion();
  const fill = useSharedValue(done / total);
  useEffect(() => {
    fill.set(reduce ? done / total : withTiming(done / total, { duration: MOTION_DURATION_MS.step, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }));
  }, [done, total, reduce, fill]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  const words = current === 0 ? 'Your rhythm' : current > total ? 'Review' : `${current} of ${total} · ${STEP_NAMES[current - 1]}`;
  return <View style={local.rail}>
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{ min: 0, max: total, now: done, text: current === 0 || current > total ? words : `Question ${current} of ${total}` }} style={local.track}>
      <Animated.View style={[local.fill, grow]} />
    </View>
    <Copy style={local.label}>{words}</Copy>
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
  rail: { gap: SPACING.xs, paddingHorizontal: LAYOUT.gutter.min, paddingVertical: SPACING.sm, backgroundColor: COLORS.background },
  track: { height: SPACING.xs + 2, overflow: 'hidden', borderRadius: RADII.pill, backgroundColor: COLORS.border },
  fill: { height: '100%', width: '100%', transformOrigin: 'left', borderRadius: RADII.pill, backgroundColor: COLORS.accent },
  label: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  days: { flexDirection: 'row', gap: SPACING.xs + 2 },
  day: { flex: 1, aspectRatio: 1, maxWidth: LAYOUT.tapTarget, borderRadius: RADII.pill },
  normal: { backgroundColor: COLORS['chart-1'] },
  test: { backgroundColor: COLORS['chart-2'] },
}));
