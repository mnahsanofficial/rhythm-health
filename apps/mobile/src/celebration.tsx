import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import { FONT_FAMILIES, LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import { Action, Copy, useStepFocus } from './ui';
import { themedStyles, useColors, useTheme } from './theme-core';

const RING = 240;
const RADIUS = 96;
const point = (share: number) => ({ x: RING / 2 + RADIUS * Math.sin(share * Math.PI * 2), y: RING / 2 - RADIUS * Math.cos(share * Math.PI * 2) });

const leftWords = (left: number) => left === 0 ? 'That was the last day.' : `${left} ${left === 1 ? 'day' : 'days'} left`;

/**
 * After a check-in is saved: the sun, or the moon in dark mode, rises along the rhythm ring. Every saved day looks the same,
 * so it can't nudge the answers. Counts come from the server's refreshed progress, and aren't shown until they've arrived.
 */
export function Celebration({ day, totalDays, recordedDays, daysLeft, seeded, onDone }: {
  day: number; totalDays: number | null; recordedDays: number | null; daysLeft: number | null; seeded: boolean; onDone: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const { scheme } = useTheme();
  const reduce = useReducedMotion();
  const heading = useStepFocus('celebration');
  const share = Math.min((recordedDays ?? day) / (totalDays ?? day), 1);
  const degrees = useSharedValue(reduce ? share * 360 : 0);
  const marker = useAnimatedStyle(() => ({ transform: [{ rotate: `${degrees.get()}deg` }] }));
  const finished = useRef(false);
  const latestDone = useRef(onDone);
  useEffect(() => { latestDone.current = onDone; }, [onDone]);
  const done = useCallback(() => { if (!finished.current) { finished.current = true; latestDone.current(); } }, []);

  useEffect(() => {
    degrees.set(withTiming(share * 360, { duration: MOTION_DURATION_MS.reveal, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System }));
  }, [degrees, share]);
  useEffect(() => { try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); } catch { /* A phone without haptics still gets the words. */ } }, []);
  // With a screen reader on it waits for a tap: closing by itself could cut off what's being read.
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = (reading: boolean) => { if (active && !reading) timer = setTimeout(done, MOTION_DURATION_MS.celebration); };
    AccessibilityInfo.isScreenReaderEnabled().then(wait).catch(() => wait(false));
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [done]);
  const words = daysLeft === null ? null : leftWords(daysLeft);
  const spoken = `Day ${day} recorded.${words ? ` ${words.endsWith('.') ? words : `${words}.`}` : ''}`;
  useEffect(() => { if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(spoken); }, [spoken]);

  const ink = scheme === 'dark' ? COLORS.text : COLORS['on-accent'];
  const end = point(Math.min(share, 0.9999));
  return <Modal visible transparent={false} animationType="none" onRequestClose={done}>
    <Pressable accessible={false} importantForAccessibility="no" onPress={done} style={local.screen}>
      <View accessibilityViewIsModal style={local.all}><View style={local.middle}>
        {seeded && <Copy style={[local.words, { color: ink }]}>Example</Copy>}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.ring}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${RING} ${RING}`}>
            <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke={ink} strokeOpacity={0.25} strokeWidth={SPACING.md} />
            {share >= 1 ? <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke={ink} strokeWidth={SPACING.md} />
              : <Path d={`M ${RING / 2} ${RING / 2 - RADIUS} A ${RADIUS} ${RADIUS} 0 ${share > 0.5 ? 1 : 0} 1 ${end.x} ${end.y}`} fill="none" stroke={ink} strokeWidth={SPACING.md} strokeLinecap="round" />}
          </Svg>
          <Animated.View testID="celebration-marker" style={[StyleSheet.absoluteFill, marker]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${RING} ${RING}`}>
              {scheme === 'dark'
                ? <><Circle cx={RING / 2} cy={RING / 2 - RADIUS} r={18} fill={COLORS.marker} /><Circle cx={RING / 2 + 8} cy={RING / 2 - RADIUS - 5} r={14} fill={COLORS.background} /></>
                : <Circle cx={RING / 2} cy={RING / 2 - RADIUS} r={18} fill={COLORS.marker} stroke={COLORS.text} strokeWidth={LAYOUT.focusWidth} />}
            </Svg>
          </Animated.View>
        </View>
        <Copy ref={heading} accessibilityRole="header" style={[local.heading, { color: ink }]}>{`Day ${day} recorded`}</Copy>
        {words && <Copy style={[local.words, { color: ink }]}>{words}</Copy>}
      </View>
      <View style={local.bottom}><Action wide secondary onDark={ink} label="Continue" onPress={done} /></View></View>
    </Pressable>
  </Modal>;
}

const useLocal = themedStyles((COLORS, mode) => StyleSheet.create({
  screen: { flex: 1, padding: LAYOUT.gutter.min, backgroundColor: mode === 'dark' ? COLORS.background : COLORS.accent },
  all: { flex: 1 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  ring: { width: '80%', maxWidth: RING + SPACING.xl, aspectRatio: 1 },
  heading: { fontFamily: FONT_FAMILIES.display, ...NATIVE_TYPOGRAPHY['display-sm'], textAlign: 'center' },
  words: { ...NATIVE_TYPOGRAPHY.lead, textAlign: 'center' },
  bottom: { paddingBottom: SPACING.xl },
}));
