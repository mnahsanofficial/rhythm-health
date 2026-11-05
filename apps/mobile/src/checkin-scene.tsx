import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue, type StyleProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, RADII, SPACING, THEMES } from '@rhythm-health/brand';
import type { Metric } from '@rhythm-health/contract';
import { SCENE_MOVE_MS, sceneFor, sceneLevel, type ChangeIcon, type CheckinSceneChoice } from './lib/checkin-scene';
import { PLAN_DAYS } from './lib/scene';
import { themedStyles, useColors, useTheme } from './theme-core';

type Size = { width: number; height: number };
type Motion = { progress: SharedValue<number>; drift: SharedValue<number>; size: Size };
export type SceneStep = ({ kind: 'change'; action: string } | { kind: 'metric'; metric: Metric }) & { day?: number | null };

/** Where a scene rests before there's an answer. Drawing only, never a value. */
const RESTING = { sun: 0.3, night: 0.4, 'moon-arc': 0.5, ring: 0.2, change: 0, days: 0 } as const;
/** Very slow on purpose: it should be noticed only by looking away and back. */
const DRIFT_MS = MOTION_DURATION_MS.dwell * 2;
const DRIFT = SPACING.sm;
const MIN_HEIGHT = LAYOUT.primaryAction * 1.5;

const ICONS: Record<ChangeIcon, string[]> = {
  shoe: ['M3 17v-4.6c0-.8.8-1.2 1.5-.9l2 1 3-5c.3-.5 1-.6 1.4-.2l1.6 1.5 2.2 3.2c.5.7 1.2 1.2 2 1.4l2.4.6c1.1.3 1.9 1.3 1.9 2.5V17H3Z', 'M3 20.5h18', 'M11.2 10.2l-1.6 1.4', 'M12.9 12.3l-1.6 1.4'],
  cup: ['M5 9h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z', 'M17 11h1.5a2.5 2.5 0 0 1 0 5H17', 'M8 3v3', 'M12 3v3'],
  window: ['M5 3h14v18H5V3Z', 'M5 15h14', 'M8 15a4 4 0 0 1 8 0', 'M12 6.5v2', 'M8.2 8l1.2 1.2', 'M15.8 8l-1.2 1.2'],
  moon: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z', 'M16 5v3', 'M14.5 6.5h3'],
  ring: ['M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z', 'M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z'],
};
const STARS = [
  [[0.14, 0.2], [0.42, 0.12], [0.3, 0.42], [0.84, 0.46]],
  [[0.08, 0.42], [0.56, 0.3], [0.2, 0.08], [0.92, 0.2]],
  [[0.34, 0.24], [0.5, 0.48], [0.64, 0.1], [0.76, 0.34]],
  [[0.04, 0.12], [0.24, 0.56], [0.44, 0.34], [0.96, 0.08]],
];

function arc(index: number, { cx, cy, r }: { cx: number; cy: number; r: number }) {
  const point = (share: number) => {
    const angle = share * Math.PI * 2;
    return `${(cx + r * Math.sin(angle)).toFixed(2)} ${(cy - r * Math.cos(angle)).toFixed(2)}`;
  };
  const gap = 0.008;
  return `M ${point(index / 10 + gap)} A ${r} ${r} 0 0 1 ${point((index + 1) / 10 - gap)}`;
}
const ringAt = ({ width, height }: Size) => ({ cx: width / 2, cy: height / 2, r: Math.min(width, height) * 0.34 });

function Layer({ testID, style, children, size }: { testID?: string; style?: StyleProps; children?: ReactNode; size: Size }) {
  return <Animated.View testID={testID} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width={size.width} height={size.height}>{children}</Svg>
  </Animated.View>;
}

function Hills({ size: { width, height } }: { size: Size }) { const colors = useColors();
  return <Layer size={{ width, height }}>
    <Ellipse cx={width * 0.18} cy={height * 1.02} rx={width * 0.62} ry={height * 0.3} fill={colors['chart-2']} opacity={0.3} />
    <Ellipse cx={width * 0.84} cy={height * 1.08} rx={width * 0.72} ry={height * 0.34} fill={colors.moss} opacity={0.22} />
  </Layer>;
}

function SunScene({ progress, drift, size }: Motion) { const colors = useColors(); const { scheme } = useTheme();
  const rise = size.height * 0.52;
  const sun = useAnimatedStyle(() => ({ transform: [{ translateX: drift.get() * DRIFT }, { translateY: -rise * progress.get() }] }));
  const warm = useAnimatedStyle(() => ({ opacity: progress.get() }));
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={colors['chart-band']} /></Layer>
    <Layer testID="scene-warm" size={size} style={warm}><Rect width={size.width} height={size.height} fill={colors['warning-tint']} /></Layer>
    <Layer testID="scene-sun" size={size} style={sun}>
      <Circle cx={size.width / 2} cy={size.height * 0.76} r={Math.min(size.width, size.height) * 0.11} fill={colors.marker} stroke={scheme === 'dark' ? undefined : colors.text} strokeWidth={LAYOUT.focusWidth} />
    </Layer>
    <Hills size={size} />
  </>;
}

const nightSky = (scheme: string) => scheme === 'dark' ? THEMES.dark['night-tint'] : THEMES.light['chart-1'];

function Moon({ x, y, r, sky }: { x: number; y: number; r: number; sky: string }) {
  return <>
    <Circle cx={x} cy={y} r={r} fill={THEMES.light.surface} />
    <Circle cx={x + r * 0.42} cy={y - r * 0.26} r={r * 0.82} fill={sky} />
  </>;
}

function StarTier({ tier, stars, progress, size }: { tier: number; stars: number[][]; progress: SharedValue<number>; size: Size }) { const colors = useColors();
  const from = tier * 0.26;
  const style = useAnimatedStyle(() => ({ opacity: Math.min(Math.max((progress.get() - from) / 0.2, 0), 1) }));
  return <Layer testID={`scene-stars-${tier}`} size={size} style={style}>
    {stars.map(([x, y]) => <Circle key={`${x}-${y}`} cx={x * size.width} cy={y * size.height} r={tier % 2 ? SPACING.xs / 2 : SPACING.xs * 0.7} fill={colors.marker} />)}
  </Layer>;
}

function NightScene({ progress, drift, size }: Motion) { const colors = useColors(); const { scheme } = useTheme();
  const sky = nightSky(scheme);
  const drifting = useAnimatedStyle(() => ({ transform: [{ translateX: drift.get() * DRIFT }] }));
  const haze = useAnimatedStyle(() => ({ opacity: (1 - progress.get()) * 0.8 }));
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={sky} /></Layer>
    {STARS.map((stars, tier) => <StarTier key={tier} tier={tier} stars={stars} progress={progress} size={size} />)}
    <Layer size={size} style={drifting}><Moon x={size.width * 0.7} y={size.height * 0.26} r={Math.min(size.width, size.height) * 0.11} sky={sky} /></Layer>
    <Layer testID="scene-haze" size={size} style={haze}>
      <Ellipse cx={size.width * 0.3} cy={size.height * 0.3} rx={size.width * 0.42} ry={size.height * 0.13} fill={colors.control} opacity={0.5} />
      <Ellipse cx={size.width * 0.74} cy={size.height * 0.44} rx={size.width * 0.4} ry={size.height * 0.11} fill={colors.control} opacity={0.42} />
      <Ellipse cx={size.width * 0.5} cy={size.height * 0.14} rx={size.width * 0.34} ry={size.height * 0.08} fill={colors.control} opacity={0.35} />
    </Layer>
    <Hills size={size} />
  </>;
}

function MoonArcScene({ progress, drift, size }: Motion) { const colors = useColors(); const { scheme } = useTheme();
  const sky = nightSky(scheme);
  const start = { x: size.width * 0.12, y: size.height * 0.74 };
  const across = size.width * 0.38, up = size.height * 0.56;
  const moon = useAnimatedStyle(() => {
    const angle = Math.PI * progress.get();
    return { transform: [{ translateX: across * (1 - Math.cos(angle)) + drift.get() * DRIFT / 2 }, { translateY: -up * Math.sin(angle) }] };
  });
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={sky} /></Layer>
    <Layer size={size}>
      <Path d={`M ${start.x} ${start.y} A ${across} ${up} 0 0 1 ${start.x + across * 2} ${start.y}`} fill="none" stroke={colors.marker} strokeOpacity={0.6} strokeWidth={LAYOUT.focusWidth} strokeDasharray={`${SPACING.xs} ${SPACING.sm}`} />
    </Layer>
    <Layer testID="scene-moon" size={size} style={moon}><Moon x={start.x} y={start.y} r={Math.min(size.width, size.height) * 0.09} sky={sky} /></Layer>
    <Hills size={size} />
  </>;
}

function RingSegment({ index, progress, size }: { index: number; progress: SharedValue<number>; size: Size }) { const colors = useColors();
  const style = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(progress.get() * 10 - index, 0), 1) }));
  return <Layer testID="scene-ring-segment" size={size} style={style}>
    <Path d={arc(index, ringAt(size))} fill="none" stroke={colors['chart-2']} strokeWidth={SPACING.md} strokeLinecap="butt" />
  </Layer>;
}

function RingScene({ progress, drift, size }: Motion) { const colors = useColors();
  const ring = ringAt(size);
  const haze = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: drift.get() * DRIFT / 2 }] }));
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={colors['chart-band']} /></Layer>
    <Hills size={size} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, floating]}>
      <Layer size={size}><Circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={colors.border} strokeWidth={SPACING.md} /></Layer>
      <Layer testID="scene-ring-haze" size={size} style={haze}><Circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={colors['chart-2']} strokeOpacity={0.25} strokeWidth={SPACING.xl} /></Layer>
      {PLAN_DAYS.map((_, index) => <RingSegment key={index} index={index} progress={progress} size={size} />)}
    </Animated.View>
  </>;
}

function ChangeGlyph({ icon, cx, cy, side, color }: { icon: ChangeIcon; cx: number; cy: number; side: number; color: string }) {
  const scale = side / 24;
  return <>{ICONS[icon].map(d => <Path key={d} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    transform={`translate(${cx - side / 2} ${cy - side / 2}) scale(${scale})`} />)}</>;
}

function ChangeScene({ icon, progress, drift, size }: Motion & { icon: ChangeIcon }) { const colors = useColors();
  const cx = size.width / 2, cy = size.height / 2;
  const disc = Math.min(size.width, size.height) * 0.26, side = disc * 1.1;
  const lit = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: drift.get() * DRIFT / 2 }] }));
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={colors['chart-band']} /></Layer>
    <Hills size={size} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, floating]}>
      <Layer size={size}>
        <Circle cx={cx} cy={cy} r={disc} fill={colors.surface} stroke={colors.border} strokeWidth={LAYOUT.focusWidth} />
        <ChangeGlyph icon={icon} cx={cx} cy={cy} side={side} color={colors.muted} />
      </Layer>
      <Layer testID="scene-icon-lit" size={size} style={lit}>
        <Circle cx={cx} cy={cy} r={disc} fill={colors.marker} />
        <ChangeGlyph icon={icon} cx={cx} cy={cy} side={side} color={THEMES.light.text} />
      </Layer>
    </Animated.View>
  </>;
}

function DaysScene({ day, progress, drift, size }: Motion & { day?: number | null }) { const colors = useColors();
  const ring = ringAt(size);
  const today = typeof day === 'number' && day >= 1 && day <= PLAN_DAYS.length ? day : null;
  const middle = today === null ? null : (today - 0.5) / PLAN_DAYS.length * Math.PI * 2;
  const answered = useAnimatedStyle(() => ({ opacity: 0.7 + 0.3 * progress.get() }));
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: drift.get() * DRIFT / 2 }] }));
  return <>
    <Layer size={size}><Rect width={size.width} height={size.height} fill={colors['chart-band']} /></Layer>
    <Hills size={size} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, floating]}>
      {PLAN_DAYS.map((item, index) => <View key={index} testID={`scene-day-${item.phase}`} style={StyleSheet.absoluteFill}>
        <Svg width={size.width} height={size.height}>
          <Path d={arc(index, ring)} fill="none" stroke={colors[item.phase === 'baseline' ? 'chart-1' : 'chart-2']} strokeOpacity={0.45} strokeWidth={SPACING.md} />
        </Svg>
      </View>)}
      {today !== null && middle !== null && <Layer testID={`scene-today-${today}`} size={size} style={answered}>
        <Path d={arc(today - 1, ring)} fill="none" stroke={colors[PLAN_DAYS[today - 1].phase === 'baseline' ? 'chart-1' : 'chart-2']} strokeWidth={SPACING.lg} />
        <Circle cx={ring.cx + ring.r * Math.sin(middle)} cy={ring.cy - ring.r * Math.cos(middle)} r={SPACING.md} fill={colors.marker} stroke={colors.text} strokeWidth={LAYOUT.focusWidth / 2} />
      </Layer>}
    </Animated.View>
  </>;
}

/** The picture on a check-in question. Decorative: the buttons carry every label, and it holds no answer of its own. */
export function CheckinScene({ step, value, scene }: { step: SceneStep; value: string | boolean | undefined; /** A calm picture of its own, where no one question is on screen. */ scene?: CheckinSceneChoice }) { const local = useLocal();
  const reduce = useReducedMotion();
  const choice = scene ?? sceneFor(step);
  const answered = value !== undefined && value !== '';
  const level = sceneLevel(step, value);
  const resting = choice.kind === 'days' ? !answered : level === null;
  const target = choice.kind === 'days' ? (answered ? 1 : 0) : level ?? RESTING[choice.kind];
  const [size, setSize] = useState<Size>({ width: LAYOUT.contentWidth / 3, height: LAYOUT.primaryAction * 6 });
  const progress = useSharedValue(target);
  const drift = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) progress.set(target);
    else progress.set(withTiming(target, { duration: SCENE_MOVE_MS, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }));
  }, [target, reduce, progress]);
  const drifting = useRef(false);
  useEffect(() => {
    if (resting && !reduce) {
      drifting.current = true;
      drift.set(withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System));
    } else if (drifting.current) {
      drifting.current = false;
      if (reduce) drift.set(0);
      else drift.set(withTiming(0, { duration: SCENE_MOVE_MS, reduceMotion: ReduceMotion.System }));
    }
  }, [resting, reduce, drift]);

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setSize(current => current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height });
  };
  const motion = { progress, drift, size };
  return <View testID="checkin-scene" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={onLayout} style={local.scene}>
    {choice.kind === 'sun' && <SunScene {...motion} />}
    {choice.kind === 'night' && <NightScene {...motion} />}
    {choice.kind === 'moon-arc' && <MoonArcScene {...motion} />}
    {choice.kind === 'ring' && <RingScene {...motion} />}
    {choice.kind === 'change' && <ChangeScene {...motion} icon={choice.icon} />}
    {choice.kind === 'days' && <DaysScene {...motion} day={step.day} />}
  </View>;
}

const useLocal = themedStyles(() => StyleSheet.create({
  scene: { flexGrow: 1, flexBasis: MIN_HEIGHT, minHeight: MIN_HEIGHT, width: '100%', overflow: 'hidden', borderRadius: RADII.card },
}));
