import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { FONT_FAMILIES, LAYOUT, MOTION_DURATION_MS, NATIVE_TYPOGRAPHY, RADII, SPACING, themeColors } from '@rhythm-health/brand';
import { Action, Copy, useStepFocus } from './ui';
import { themedStyles, useColors } from './theme-core';

/** Illustrations stay in the light palette in both modes, like the web's landing story. */
const ART = themeColors('light');
const STARS = [[42, 38, 1.5], [96, 88, 1], [150, 26, 1.5], [214, 70, 1], [262, 30, 1.5], [318, 92, 1], [362, 44, 1.5], [24, 120, 1], [342, 150, 1]] as const;

type Sky = 'night' | 'morning' | 'noon' | 'evening';
const SUNS: Record<Exclude<Sky, 'night'>, { cx: number; cy: number; warmth: number }> = {
  morning: { cx: 110, cy: 84, warmth: 0.45 },
  noon: { cx: 200, cy: 44, warmth: 0.08 },
  evening: { cx: 286, cy: 92, warmth: 0.7 },
};

/** The web landing's sky and hills, at four times of day. */
function Scene({ sky }: { sky: Sky }) {
  const sun = sky === 'night' ? null : SUNS[sky];
  return <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMax slice">
    <Rect width={400} height={400} fill={sky === 'night' ? ART.night : ART.oat} />
    {sun && <Rect width={400} height={400} fill={ART.sun} opacity={sun.warmth} />}
    {sun && <Circle cx={sun.cx} cy={sun.cy} r={26} fill={ART.sun} />}
    {sky === 'night' && STARS.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={ART.paper} />)}
    {sky === 'night' && <><Circle cx={282} cy={58} r={20} fill={ART.paper} /><Circle cx={291} cy={52} r={17} fill={ART.night} /></>}
    <Path d="M0 300 Q75 270 155 296 T312 288 T400 282 V400 H0 Z" fill={ART['moss-tint']} />
    <Rect y={330} width={400} height={70} fill={ART.moss} />
  </Svg>;
}

/** Small text inside a picture of the app. It stays one size, because the slide's line is what gets read. */
function Mini({ children, tone = 'muted', size = tone === 'muted' ? 'caption' : 'body', display = false, center = false }: { children: ReactNode; tone?: 'muted' | 'ink' | 'accent' | 'on-accent'; size?: 'caption' | 'body' | 'title' | 'headline'; display?: boolean; center?: boolean }) {
  const COLORS = useColors();
  const color = tone === 'muted' ? COLORS.muted : tone === 'ink' ? COLORS.ink : tone === 'accent' ? COLORS.moss : COLORS['on-accent'];
  return <Copy allowFontScaling={false} style={[NATIVE_TYPOGRAPHY[size], { color }, display && { fontFamily: FONT_FAMILIES.display }, center && { textAlign: 'center' }]}>{children}</Copy>;
}

function AskScreen() { const local = useLocal();
  return <>
    <Mini tone="ink" size="title" display>Ask a question.</Mini>
    <View style={local.field}><Mini tone="ink">Does walking after dinner improve my sleep?</Mini></View>
    <View style={local.chips}>{['Less caffeine', 'Earlier bedtime', 'Morning light'].map(chip => <View key={chip} style={local.chip}><Mini tone="ink" size="caption">{chip}</Mini></View>)}</View>
    <View style={local.button}><Mini tone="on-accent">Design experiment</Mini></View>
  </>;
}
function PredictionScreen() { const local = useLocal();
  return <>
    <Mini>Written down before day 1</Mini>
    <Mini tone="ink" size="title" display>Morning energy</Mini>
    <Mini tone="accent" size="headline" display>+8–15%</Mini>
    <View style={local.track}><View style={local.range} /></View>
    <Mini>A range, not a promise.</Mini>
    <View style={local.note}><Mini tone="ink">3 normal days, then 7 test days</Mini></View>
  </>;
}
function CheckInScreen() { const local = useLocal();
  return <>
    <Mini tone="ink" size="title" display>Day 4 of 10</Mini>
    <View style={local.days}>{Array.from({ length: 10 }, (_, day) => <View key={day} style={[local.day, day < 4 && local.dayDone]} />)}</View>
    <Mini tone="ink">How did you sleep?</Mini>
    <View style={local.scale}>{[1, 2, 3, 4, 5].map(step => <View key={step} style={[local.step, step === 4 && local.stepOn]}><Mini tone={step === 4 ? 'on-accent' : 'ink'} size="caption" center>{step}</Mini></View>)}</View>
    <Mini tone="ink">Did you make the change?</Mini>
    <View style={local.chips}><View style={[local.chip, local.stepOn]}><Mini tone="on-accent" size="caption">Yes</Mini></View><View style={local.chip}><Mini tone="ink" size="caption">Not today</Mini></View></View>
  </>;
}
function ReportScreen() { const local = useLocal();
  return <>
    <Mini tone="ink" size="title" display>Lab Report</Mini>
    <Mini>Predicted</Mini>
    <View style={local.track}><View style={local.range} /></View>
    <Mini tone="ink">+8–15%</Mini>
    <Mini>What happened</Mini>
    <View style={local.track}><View style={local.observed} /></View>
    <Mini tone="ink">+11%</Mini>
    <View style={local.note}><Mini tone="ink">Likely signal. A pattern, not proof.</Mini></View>
  </>;
}

const SLIDES = [
  { line: 'Stop guessing. Test one habit.', sky: 'night', Screen: AskScreen },
  { line: 'See the prediction before day one.', sky: 'morning', Screen: PredictionScreen },
  { line: 'Check in each day in about 30 seconds.', sky: 'noon', Screen: CheckInScreen },
  { line: 'Compare the prediction with what happened.', sky: 'evening', Screen: ReportScreen },
] as const;

function Dot({ on, number, onPress }: { on: boolean; number: number; onPress: () => void }) { const local = useLocal();
  const grow = useSharedValue(on ? 1 : 0);
  useEffect(() => { grow.set(withTiming(on ? 1 : 0, { duration: MOTION_DURATION_MS.response, reduceMotion: ReduceMotion.System })); }, [on, grow]);
  const lit = useAnimatedStyle(() => ({ opacity: grow.get() }));
  return <Pressable accessibilityRole="button" accessibilityLabel={`Go to slide ${number} of ${SLIDES.length}`} accessibilityState={{ selected: on }} onPress={onPress} style={local.dotTarget}>
    <View style={local.dot}><Animated.View style={[StyleSheet.absoluteFill, local.dotOn, lit]} /></View>
  </Pressable>;
}

function PlayIcon({ paused }: { paused: boolean }) { const COLORS = useColors();
  return <Svg width={SPACING.md} height={SPACING.md} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {paused ? <Path d="M4.5 2.5v11l9-5.5Z" fill={COLORS.muted} /> : <Path d="M5 3v10M11 3v10" stroke={COLORS.muted} strokeWidth={2} strokeLinecap="round" />}
  </Svg>;
}

function useScreenReader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return; // The web build of this API always answers yes.
    let current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (current) setOn(value); });
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => { current = false; listener.remove(); };
  }, []);
  return on;
}

/**
 * The phone's front door: one line and one picture of the app per slide, moving by themselves, with
 * the same two ways in on every slide. It waits for anyone who has asked for less motion or uses a
 * screen reader, and for anyone holding a slide or pressing Pause.
 */
export function Landing({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) { const local = useLocal();
  const heading = useStepFocus('landing');
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const reduce = useReducedMotion();
  const reader = useScreenReader();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const moving = useRef<number | null>(null); // Where a move we started is heading; the scroll reports stay quiet until it arrives.
  const canMove = !reduce && !reader;

  const moveTo = (page: number, animated: boolean) => {
    moving.current = page;
    setIndex(page % SLIDES.length);
    pager.current?.scrollTo({ x: page * width, y: 0, animated });
  };

  useEffect(() => {
    if (!canMove || paused || held) return;
    const timer = setTimeout(() => moveTo(index + 1, true), MOTION_DURATION_MS.dwell);
    return () => clearTimeout(timer);
  }); // Every render restarts the wait, so a swipe or a dot always gets a full look.

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = nativeEvent.contentOffset.x;
    // The last page repeats the first, so the loop keeps moving forward. On arrival, jump to the real one.
    if (x >= SLIDES.length * width - 1) { moveTo(0, false); return; }
    const target = moving.current;
    if (target !== null) { if (Math.abs(x - target * width) < 1) moving.current = null; return; }
    setIndex(Math.round(x / width) % SLIDES.length);
  };

  return <View style={local.page} onLayout={({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width)}>
    <ScrollView ref={pager} testID="landing-slides" horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} style={local.pager}
      onScroll={onScroll} onScrollBeginDrag={() => { moving.current = null; setHeld(true); }} onScrollEndDrag={() => setHeld(false)}>
      {[...SLIDES, SLIDES[0]].map(({ line, sky, Screen }, page) => {
        const copy = page === SLIDES.length;
        const current = page === index;
        return <View key={page} style={[local.slide, { width }]} accessibilityElementsHidden={!current} importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}>
          <View style={local.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={local.art}><Scene sky={sky} /></View>
            <View style={local.phone}><Mini>Example</Mini><Screen /></View>
          </View>
          <Copy ref={page === 0 ? heading : undefined} accessibilityRole={copy ? undefined : 'header'} style={local.line}>{line}</Copy>
        </View>;
      })}
    </ScrollView>
    <View style={local.controls}>
      <View style={local.dots}>{SLIDES.map(({ line }, page) => <Dot key={line} number={page + 1} on={page === index} onPress={() => moveTo(page, !reduce)} />)}</View>
      {canMove && <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Play slides' : 'Pause slides'} onPress={() => setPaused(value => !value)} style={local.pause}><PlayIcon paused={paused} /></Pressable>}
    </View>
    <View style={local.ways}>
      <Action wide label="Start an experiment" onPress={onStart} />
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn} style={({ pressed }) => [local.signIn, pressed && { opacity: 0.6 }]}><Copy style={local.signInText}>Sign in</Copy></Pressable>
    </View>
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  page: { flex: 1 },
  pager: { flex: 1 },
  slide: { flex: 1 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: SPACING.lg, overflow: 'hidden' },
  art: { position: 'absolute', left: 0, right: 0, top: 0, bottom: SPACING.xl },
  phone: { width: '74%', maxWidth: LAYOUT.buttonMaxWidth, maxHeight: '100%', gap: SPACING.sm, padding: SPACING.md, overflow: 'hidden', backgroundColor: COLORS.paper,
    borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control },
  line: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY.title, color: COLORS.ink, textAlign: 'center', paddingHorizontal: LAYOUT.gutter.min, paddingTop: SPACING.md, minHeight: NATIVE_TYPOGRAPHY.title.lineHeight * 2 + SPACING.md },
  field: { padding: SPACING.sm, borderRadius: RADII.control, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control },
  button: { alignSelf: 'stretch', alignItems: 'center', padding: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.moss },
  track: { height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.line, overflow: 'hidden' },
  range: { position: 'absolute', left: '30%', width: '40%', top: 0, bottom: 0, borderRadius: RADII.pill, backgroundColor: COLORS['moss-tint'], borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.moss },
  observed: { position: 'absolute', left: 0, width: '50%', top: 0, bottom: 0, borderRadius: RADII.pill, backgroundColor: COLORS.moss },
  note: { padding: SPACING.sm, borderRadius: RADII.control, backgroundColor: COLORS['moss-tint'] },
  days: { flexDirection: 'row', gap: SPACING.xs },
  day: { flex: 1, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.line },
  dayDone: { backgroundColor: COLORS.moss },
  scale: { flexDirection: 'row', gap: SPACING.xs },
  step: { flex: 1, paddingVertical: SPACING.xs, borderRadius: RADII.control, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control },
  stepOn: { backgroundColor: COLORS.moss, borderColor: COLORS.moss },
  controls: { minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row' },
  dotTarget: { minWidth: LAYOUT.tapTarget - SPACING.sm, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  dot: { width: SPACING.sm, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.control, overflow: 'hidden' },
  dotOn: { backgroundColor: COLORS.moss },
  pause: { position: 'absolute', right: LAYOUT.gutter.min - SPACING.sm, minWidth: LAYOUT.primaryAction, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  ways: { width: '100%', maxWidth: LAYOUT.contentWidth / 3, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter.min, gap: SPACING.xs },
  signIn: { minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  signInText: { fontFamily: FONT_FAMILIES.sansMedium, color: COLORS.moss },
}));
