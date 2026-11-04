import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING, THEMES } from '@rhythm-health/brand';
import { Icon, type IconName } from './icons';
import { ACTIVITY_OPTIONS, AGE_OPTIONS, habitTime, minutes, nightMinutes, suggestedSleep, type Draft } from './lib/onboarding';
import { arcFraction, goalIcon, habitIcon, marker, RING, RING_LENGTH, SCENE, sceneHeight } from './lib/scene';
import { themedStyles, useColors, useTheme } from './theme-core';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const NIGHT_INK = THEMES.dark.text;
const VIEW_BOX = `0 0 ${SCENE.width} ${SCENE.height}`;

/** Follows a value within `response`. With Reduce Motion it's simply there. */
function useTween(target: number, from = target) {
  const reduce = useReducedMotion();
  const value = useSharedValue(reduce ? target : from);
  useEffect(() => {
    value.set(reduce ? target : withTiming(target, { duration: MOTION_DURATION_MS.response, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }));
  }, [target, reduce, value]);
  return value;
}

/** Scenes crossfade in place, and the ring stays on between the steps that share it, so one step morphs into the next. */
function Layer({ shown, children }: { shown: boolean; children: ReactNode }) {
  const opacity = useTween(shown ? 1 : 0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

function Day({ age }: { age: number }) { const COLORS = useColors(); const { scheme } = useTheme();
  const place = age < 0 ? 0.2 : 0.3 + 0.08 * age;
  const x = 40 + 310 * place; const y = 190 - 150 * Math.sin(Math.PI * place);
  const sunX = useTween(x); const sunY = useTween(y);
  const sun = useAnimatedProps(() => ({ cx: sunX.get(), cy: sunY.get() }));
  return <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
    <Rect width={SCENE.width} height={SCENE.height} fill={THEMES[scheme === 'dark' ? 'dark' : 'light'][scheme === 'dark' ? 'chart-band' : 'night-tint']} />
    <AnimatedCircle testID="scene-day-sun" cx={x} cy={y} r={26} fill={COLORS.marker} stroke={scheme === 'dark' ? undefined : COLORS.text} strokeWidth={LAYOUT.focusWidth} animatedProps={sun} />
    <Ellipse cx={110} cy={60} rx={40} ry={12} fill={COLORS.surface} opacity={0.7} />
    <Ellipse cx={290} cy={90} rx={54} ry={14} fill={COLORS.surface} opacity={0.7} />
    <Ellipse cx={195} cy={290} rx={330} ry={90} fill={COLORS['chart-2']} opacity={0.3} />
  </Svg>;
}

const STARS = [[40, 40], [90, 90], [60, 190], [130, 30], [300, 30], [350, 80], [335, 200], [270, 60], [25, 120], [365, 140]];
function RingScene({ draft, step, shown }: { draft: Draft; step: number; shown: boolean }) { const COLORS = useColors(); const local = useLocal(); const { scheme } = useTheme();
  const bed = minutes(draft.usual_sleep_schedule?.bedtime ?? '');
  const wake = minutes(draft.usual_sleep_schedule?.wake_time ?? '');
  const span = nightMinutes(draft) ?? 0;
  const hours = draft.usual_sleep_hours ?? (span ? suggestedSleep(draft) : 0);
  const inBed = shown ? arcFraction(span) * RING_LENGTH : 0;
  const asleep = shown && step !== 2 ? arcFraction(hours * 60) * RING_LENGTH : 0;
  const inBedLength = useTween(inBed, 0); const asleepLength = useTween(asleep, 0);
  const start = useTween((arcFraction(bed ?? 0) * 360) - 90);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${start.get()}deg` }] }));
  const inBedProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH - inBedLength.get() }));
  const asleepProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH - asleepLength.get() }));
  const moon = marker(bed ?? 0); const sun = marker(wake ?? 0);
  const moonX = useTween(moon.x); const moonY = useTween(moon.y); const sunX = useTween(sun.x); const sunY = useTween(sun.y);
  const moonProps = useAnimatedProps(() => ({ cx: moonX.get(), cy: moonY.get() }));
  const biteProps = useAnimatedProps(() => ({ cx: moonX.get() + 6, cy: moonY.get() - 4 }));
  const sunProps = useAnimatedProps(() => ({ cx: sunX.get(), cy: sunY.get() }));
  const sky = THEMES[scheme === 'dark' ? 'dark' : 'light'][scheme === 'dark' ? 'night-tint' : 'chart-1'];
  const habits = (draft.regular_habits ?? []).map(label => habitTime(label, draft)).filter((time): time is string => Boolean(time));
  return <>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Rect width={SCENE.width} height={SCENE.height} fill={sky} />
      {STARS.map(([x, y]) => <Circle key={`${x}:${y}`} cx={x} cy={y} r={1.6} fill={NIGHT_INK} opacity={0.7} />)}
    </Svg>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} style={StyleSheet.absoluteFill}>
      <Circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={NIGHT_INK} strokeOpacity={0.2} strokeWidth={SPACING.md} />
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, turn]}>
      <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
        <AnimatedCircle testID="scene-arc" cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={THEMES.dark['chart-1']} strokeWidth={SPACING.md} strokeDasharray={[RING_LENGTH, RING_LENGTH]} strokeDashoffset={RING_LENGTH - inBed} animatedProps={inBedProps} />
        <AnimatedCircle testID="scene-asleep" cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={THEMES.dark['chart-2']} strokeWidth={SPACING.md} strokeDasharray={[RING_LENGTH, RING_LENGTH]} strokeDashoffset={RING_LENGTH - asleep} animatedProps={asleepProps} />
      </Svg>
    </Animated.View>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} style={StyleSheet.absoluteFill}>
      {bed !== null && <>
        <AnimatedCircle testID="scene-moon" cx={moon.x} cy={moon.y} r={14} fill={COLORS.marker} animatedProps={moonProps} />
        <AnimatedCircle cx={moon.x + 6} cy={moon.y - 4} r={11} fill={sky} animatedProps={biteProps} />
      </>}
      {wake !== null && <AnimatedCircle testID="scene-sun" cx={sun.x} cy={sun.y} r={14} fill={COLORS.marker} stroke={NIGHT_INK} strokeWidth={LAYOUT.focusWidth} animatedProps={sunProps} />}
      {step === 8 && habits.map(time => { const at = marker(minutes(time)!); return <Circle key={time} testID="scene-habit" cx={at.x} cy={at.y} r={6} fill={COLORS.marker} stroke={sky} strokeWidth={LAYOUT.focusWidth} />; })}
    </Svg>
    {step === 3 && span > 0 && <View style={local.center}><Text allowFontScaling={false} style={local.hours}>{`${hours} h`}</Text></View>}
    {step !== 3 && <HourLabels />}
  </>;
}

/** The picture has a fixed shape, so its labels don't grow with text size. The rows and values below do, and carry the same facts. */
function HourLabels() { const local = useLocal();
  const label = (text: string, style: object) => <Text allowFontScaling={false} style={[local.hourLabel, style]}>{text}</Text>;
  return <View style={local.center}><View style={local.labels}>
    {label('12am', local.top)}{label('12pm', local.bottom)}{label('6am', local.right)}{label('6pm', local.left)}
  </View></View>;
}

const STRIDE = [3, 9, 15, 22];
function Walker({ level, height }: { level: number; height: number }) { const COLORS = useColors(); const { width } = useWindowDimensions();
  const prints = level < 0 ? 0 : (level + 1) * 3;
  const scale = Math.max(width / SCENE.width, height / SCENE.height);
  const offset = useTween((60 + prints * 22 - SCENE.width / 2) * scale);
  const walk = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const stride = STRIDE[Math.max(level, 0)];
  return <>
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Line x1={0} y1={208} x2={SCENE.width} y2={208} stroke={COLORS.text} strokeOpacity={0.3} strokeWidth={LAYOUT.focusWidth} />
      {Array.from({ length: prints }, (_, index) => <Ellipse key={index} testID="scene-footprint" cx={50 + index * 22} cy={index % 2 ? 216 : 222} rx={7} ry={3} fill={COLORS['chart-2']} />)}
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, walk]}>
      <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
        <Circle cx={SCENE.width / 2} cy={118} r={13} fill={COLORS.text} />
        <Path d={`M ${SCENE.width / 2} 132 V 170 M ${SCENE.width / 2} 170 L ${SCENE.width / 2 - stride} 206 M ${SCENE.width / 2} 170 L ${SCENE.width / 2 + stride} 206 M ${SCENE.width / 2} 142 L ${SCENE.width / 2 - stride * 0.8} 162 M ${SCENE.width / 2} 142 L ${SCENE.width / 2 + stride * 0.8} 160`} stroke={COLORS.text} strokeWidth={6} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  </>;
}

function Picked({ icon }: { icon: IconName }) { const local = useLocal();
  const reduce = useReducedMotion();
  const size = useSharedValue(reduce ? 1 : 0.6);
  useEffect(() => { size.set(reduce ? 1 : withTiming(1, { duration: MOTION_DURATION_MS.response, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System })); }, [reduce, size]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: size.get() }] }));
  return <Animated.View testID="scene-picked" style={[local.disc, pop]}><Icon name={icon} size={SPACING.xl} /></Animated.View>;
}
function PickedIcons({ picks }: { picks: { key: string; icon: IconName }[] }) { const local = useLocal();
  const empty = Math.max(0, 3 - picks.length);
  return <View style={local.picks}>
    {picks.slice(0, 8).map(({ key, icon }) => <Picked key={key} icon={icon} />)}
    {Array.from({ length: empty }, (_, index) => <View key={index} style={local.placeholder} />)}
  </View>;
}

/** The picture above the question. It stays put while the question slides, and is decoration: every fact is also in words. */
export function OnboardingScene({ step, draft }: { step: number; draft: Draft }) { const local = useLocal();
  const { height: windowHeight } = useWindowDimensions();
  const height = sceneHeight(windowHeight, step);
  const age = AGE_OPTIONS.findIndex(option => option.value === draft.age_range);
  const level = ACTIVITY_OPTIONS.findIndex(option => option.value === draft.activity_level);
  const ring = step === 2 || step === 3 || step === 8;
  const picks = step === 5 ? (draft.goals ?? []).map(goal => ({ key: goal, icon: goalIcon(goal) }))
    : step === 6 ? (draft.regular_habits ?? []).map(habit => ({ key: habit, icon: habitIcon(habit) }))
    : (draft.constraints ?? []).map(limit => ({ key: limit, icon: 'limits' as const }));
  return <View testID="onboarding-scene" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[local.scene, { height }]}>
    <Layer shown={!ring}><Day age={step === 4 ? 6 : age} /></Layer>
    <Layer shown={step === 4}>{step === 4 && <Walker level={level} height={height} />}</Layer>
    <Layer shown={step >= 5 && step <= 7}>{step >= 5 && step <= 7 && <PickedIcons picks={picks} />}</Layer>
    <Layer shown={ring}>{ring && <RingScene draft={draft} step={step} shown={ring} />}</Layer>
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  scene: { width: '100%', overflow: 'hidden', backgroundColor: COLORS.surface },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  hours: { ...NATIVE_TYPOGRAPHY.title, color: NIGHT_INK },
  labels: { height: '100%', aspectRatio: 1.35 },
  hourLabel: { position: 'absolute', ...NATIVE_TYPOGRAPHY.caption, lineHeight: NATIVE_TYPOGRAPHY.caption.fontSize + 2, color: NIGHT_INK },
  top: { top: 0, left: 0, right: 0, textAlign: 'center' },
  bottom: { bottom: 0, left: 0, right: 0, textAlign: 'center' },
  left: { left: SPACING.xs, top: '50%', marginTop: -SPACING.sm },
  right: { right: SPACING.xs, top: '50%', marginTop: -SPACING.sm },
  picks: { ...StyleSheet.absoluteFill, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md },
  disc: { width: LAYOUT.primaryAction + SPACING.md, height: LAYOUT.primaryAction + SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill, backgroundColor: COLORS.surface },
  placeholder: { width: LAYOUT.primaryAction + SPACING.md, height: LAYOUT.primaryAction + SPACING.md, borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth, borderStyle: 'dashed', borderColor: COLORS.control },
}));
