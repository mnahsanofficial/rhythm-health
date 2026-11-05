import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { LAYOUT, MOTION_DURATION_MS, RADII, SPACING } from '@rhythm-health/brand';
import { dayArc, marker, RING, SCENE } from './lib/scene';
import { themedStyles, useColors, useTheme } from './theme-core';

const VIEW_BOX = `0 0 ${SCENE.width} ${SCENE.height}`;
const DAY_MS = MOTION_DURATION_MS.press;

function Day({ d, phase, index }: { d: string; phase: 'baseline' | 'test'; index: number }) { const colors = useColors();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) opacity.set(withDelay(index * DAY_MS, withTiming(1, { duration: MOTION_DURATION_MS.response, reduceMotion: ReduceMotion.System })));
  }, [reduce, index, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View testID={`plan-ring-${phase}`} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
      <Path d={d} fill="none" stroke={colors[phase === 'baseline' ? 'chart-1' : 'chart-2']} strokeWidth={SPACING.md} />
    </Svg>
  </Animated.View>;
}

/** The plan drawn once around a ring: normal days, then test days, with the sun on day 1. Decorative: the words above say the same. */
export function PlanRing({ baselineDays, testDays }: { baselineDays: number; testDays: number }) { const colors = useColors(); const local = useLocal(); const { scheme } = useTheme();
  const total = baselineDays + testDays;
  const sun = marker((0.5 / total) * 24 * 60);
  return <View testID="plan-ring" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={local.scene}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMax slice">
      <Ellipse cx={SCENE.width / 2} cy={SCENE.height + 40} rx={SCENE.width * 0.85} ry={90} fill={colors['chart-2']} opacity={0.3} />
    </Svg>
    {Array.from({ length: total }, (_, index) => <Day key={index} index={index} d={dayArc(index, total)} phase={index < baselineDays ? 'baseline' : 'test'} />)}
    <View testID="plan-ring-sun" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
        <Circle cx={sun.x} cy={sun.y} r={RING.r * 0.16} fill={colors.marker} stroke={scheme === 'dark' ? undefined : colors.text} strokeWidth={LAYOUT.focusWidth} />
      </Svg>
    </View>
  </View>;
}

const useLocal = themedStyles(colors => StyleSheet.create({
  scene: { flexGrow: 1, flexBasis: LAYOUT.primaryAction * 3, minHeight: LAYOUT.primaryAction * 3, width: '100%', overflow: 'hidden', borderRadius: RADII.card, backgroundColor: colors['chart-band'] },
}));
