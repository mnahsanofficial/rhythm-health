import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Metric, Prediction } from '@rhythm-health/contract';
import { signedPercent } from './lib/proposals';
import { metricName } from './lib/short-labels';
import { Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

const [x1, y1, x2, y2] = MOTION_EASE.settle;
const DIRECTION = { increase: 'likely to go up', decrease: 'likely to go down', no_change: 'likely to stay about the same' };

/** Starts final, so a failed preference read or reduced motion still shows the true range at once. */
function useRangeReveal(reveal: boolean) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!reveal) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      scale.setValue(0);
      animation = Animated.timing(scale, { toValue: 1, duration: MOTION_DURATION_MS.reveal, easing: Easing.bezier(x1, y1, x2, y2), useNativeDriver: true });
      animation.start();
    }).catch(() => { scale.setValue(1); });
    return () => { active = false; animation?.stop(); };
  }, [scale, reveal]);
  return scale;
}

/** A filled stretch on a scale, in the same style wherever a change is shown. The marker is the person's own guess. */
export function ChangeBar({ low, high, from, to, guess = null, reveal = false, label }: { low: number; high: number; from: number | null; to: number | null; guess?: number | null; reveal?: boolean; label: string }) { const local = useLocal(); const ui = useStyles();
  const scale = useRangeReveal(reveal);
  const position = (value: number) => ((value - low) / (high - low)) * 100;
  const left = from === null || to === null ? null : position(Math.min(from, to));
  const width = from === null || to === null ? null : Math.max(position(Math.max(from, to)) - position(Math.min(from, to)), 1);
  return <View testID="change-bar" accessible accessibilityRole="image" accessibilityLabel={label} style={ui.stack}>
    <View style={local.bar}>
      <View style={local.track}>
        <View style={[local.zero, { left: `${position(0)}%` }]} />
        {left !== null && width !== null && <Animated.View testID="change-bar-fill" style={[local.range, { left: `${left}%`, width: `${width}%`, transformOrigin: 'left', transform: [{ scaleX: scale }] }]} />}
      </View>
      {guess !== null && <View testID="guess-marker" style={[local.marker, { left: `${position(guess)}%` }]} />}
    </View>
    <View accessible={false} style={local.ends}>
      <Copy style={local.end}>{signedPercent(low)}</Copy>
      <Copy style={local.end}>0%</Copy>
      <Copy style={local.end}>{signedPercent(high)}</Copy>
    </View>
  </View>;
}

function PredictionRange({ min, max, guess }: { min: number; max: number; guess: number | null }) {
  const extent = Math.round(Math.max(Math.abs(min), Math.abs(max), Math.abs(guess ?? 0), 1));
  return <ChangeBar reveal low={-extent} high={extent} from={min} to={max} guess={guess}
    label={`Expected change range ${signedPercent(min)} to ${signedPercent(max)}${guess === null ? '' : `, your guess ${signedPercent(guess)}`}`} />;
}

/** The original forecast, shown as a range with its confidence level and never as a single number. */
export function Forecast({ prediction, metrics, guess = null, headingRef }: { prediction: Prediction; metrics: Metric[]; guess?: number | null; headingRef?: Ref<ComponentRef<typeof Text>> }) { const local = useLocal(); const ui = useStyles();
  const metric = metrics.find(item => item.key === prediction.target_metric);
  const label = metric ? metricName(metric) : prediction.target_metric;
  return <View style={local.card}>
    {guess !== null && <View>
      <Copy style={local.eyebrow}>Your guess</Copy>
      <Copy style={local.value}>{signedPercent(guess)}</Copy>
    </View>}
    <Copy style={local.eyebrow}>We predict</Copy>
    <Copy ref={headingRef} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[ui.sectionTitle, NATIVE_TYPOGRAPHY.lead]}>{label} is {DIRECTION[prediction.direction]}</Copy>
    <Copy style={local.value}>{signedPercent(prediction.expected_change_min)} to {signedPercent(prediction.expected_change_max)}</Copy>
    <PredictionRange min={prediction.expected_change_min} max={prediction.expected_change_max} guess={guess} />
    <Copy style={NATIVE_TYPOGRAPHY.caption}>Confidence: {prediction.confidence.charAt(0).toUpperCase() + prediction.confidence.slice(1)}</Copy>
  </View>;
}

/** The reasons behind the range. They sit behind "Why?", beside the forecast. */
export function ForecastReasons({ prediction }: { prediction: Prediction }) {
  return <>
    <Copy>{prediction.reasoning}</Copy>
    {prediction.uncertainty_factors.length > 0 && <View>
      <Copy>Things that may affect the result</Copy>
      {prediction.uncertainty_factors.map(factor => <Copy key={factor}>• {factor}</Copy>)}
    </View>}
  </>;
}

const useLocal = themedStyles((COLORS, mode) => { const ui = useStyles.forMode(mode); return StyleSheet.create({
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADII.card, backgroundColor: COLORS['night-tint'], borderTopWidth: SPACING.xs, borderColor: COLORS.night },
  eyebrow: { color: COLORS.night },
  value: { ...ui.number, ...NATIVE_TYPOGRAPHY.headline, color: COLORS.ink },
  bar: { height: SPACING.md + SPACING.sm, justifyContent: 'center' },
  track: { height: SPACING.md, borderRadius: RADII.pill, backgroundColor: COLORS.line, overflow: 'hidden' },
  zero: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.muted },
  marker: { position: 'absolute', top: 0, bottom: 0, width: SPACING.xs, marginLeft: -SPACING.xs / 2, borderRadius: RADII.pill, borderWidth: 1, borderColor: COLORS['night-tint'], backgroundColor: COLORS.ink },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: RADII.pill, backgroundColor: COLORS.night },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  end: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
}); });
