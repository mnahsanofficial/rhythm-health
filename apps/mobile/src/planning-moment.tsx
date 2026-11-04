import { useEffect, type ComponentRef, type Ref } from 'react';
import { StyleSheet, type Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING, THEMES } from '@rhythm-health/brand';
import { PLAN_DAYS, SCENE } from './lib/scene';
import { Copy, Status, Title, useStyles } from './ui';
import { themedStyles, useColors, useTheme } from './theme-core';

const VIEW_BOX = `0 0 ${SCENE.width} ${SCENE.height}`;
/** The ring takes about as long as a plan usually does, then stays drawn. It doesn't measure anything. */
const DAY_MS = MOTION_DURATION_MS.reveal * 2.5;
const SUN = { x: SCENE.width / 2, low: 200, rise: 110 };
/** One request does all of this at once, so none of them can honestly be ticked off while it runs. */
const STEPS = ["Checking it's a safe, small change", 'Designing your experiment', 'Forecasting what might happen'];

function PlanDay({ d, phase, index }: { d: string; phase: 'baseline' | 'test'; index: number }) { const COLORS = useColors();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) opacity.set(withDelay(index * DAY_MS, withTiming(1, { duration: MOTION_DURATION_MS.response, reduceMotion: ReduceMotion.System })));
  }, [reduce, index, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View testID={`planning-day-${phase}`} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
      <Path d={d} fill="none" stroke={COLORS[phase === 'baseline' ? 'chart-1' : 'chart-2']} strokeWidth={SPACING.md} />
    </Svg>
  </Animated.View>;
}

function RisingSun() { const COLORS = useColors(); const { scheme } = useTheme();
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? -SUN.rise : 0);
  useEffect(() => {
    if (!reduce) y.set(withTiming(-SUN.rise, { duration: DAY_MS * PLAN_DAYS.length, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }));
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
      <Circle cx={SUN.x} cy={SUN.low} r={26} fill={COLORS.marker} stroke={scheme === 'dark' ? undefined : COLORS.text} strokeWidth={LAYOUT.focusWidth} />
    </Svg>
  </Animated.View>;
}

function PlanningScene() { const COLORS = useColors(); const local = useLocal(); const { scheme } = useTheme();
  return <View testID="planning-scene" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.scene}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
      <Rect width={SCENE.width} height={SCENE.height} fill={THEMES[scheme === 'dark' ? 'dark' : 'light'][scheme === 'dark' ? 'chart-band' : 'night-tint']} />
    </Svg>
    <RisingSun />
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
      <Ellipse cx={195} cy={300} rx={330} ry={90} fill={COLORS['chart-2']} opacity={0.3} />
    </Svg>
    {PLAN_DAYS.map((day, index) => <PlanDay key={index} d={day.d} phase={day.phase} index={index} />)}
  </View>;
}

function Step({ text }: { text: string }) { const local = useLocal();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    const fade = (to: number) => withTiming(to, { duration: MOTION_DURATION_MS.reveal, reduceMotion: ReduceMotion.System });
    opacity.set(withRepeat(withSequence(fade(0.3), fade(1)), -1));
  }, [reduce, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <View accessible accessibilityLabel={`${text}, in progress`} style={local.step}>
    <Animated.View testID="planning-step-working" style={[local.dot, style]} />
    <Copy style={local.stepText}>{text}</Copy>
  </View>;
}

/**
 * While a plan is being written. Display only: it starts no request and holds no answer. The whole plan comes back from
 * one request, with no stages to report, so the steps say what's happening and never tick.
 */
export function PlanningMoment({ heading, question }: { heading: Ref<ComponentRef<typeof Text>>; question: string }) { const ui = useStyles();
  return <View style={ui.stack}>
    <Title textRef={heading}>Planning your experiment.</Title>
    <Copy style={ui.muted}>{question}</Copy>
    <PlanningScene />
    <View style={ui.stack}>{STEPS.map(text => <Step key={text} text={text} />)}</View>
    <Status style={ui.muted}>Usually 10–20 seconds.</Status>
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  scene: { width: '100%', aspectRatio: SCENE.width / SCENE.height, overflow: 'hidden', borderRadius: RADII.card },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dot: { width: SPACING.sm, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.accent },
  stepText: { ...NATIVE_TYPOGRAPHY.body, flex: 1 },
}));
