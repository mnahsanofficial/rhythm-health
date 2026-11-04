import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Metric, Prediction } from '@rhythm-health/contract';
import { signedPercent } from './lib/proposals';
import { Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

const [x1, y1, x2, y2] = MOTION_EASE.settle;
const DIRECTION = { increase: 'likely to go up', decrease: 'likely to go down', no_change: 'likely to stay about the same' };

/** Starts final, so a failed preference read or reduced motion still shows the true range at once. */
function useRangeReveal() {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      scale.setValue(0);
      animation = Animated.timing(scale, { toValue: 1, duration: MOTION_DURATION_MS.reveal, easing: Easing.bezier(x1, y1, x2, y2), useNativeDriver: true });
      animation.start();
    }).catch(() => { scale.setValue(1); });
    return () => { active = false; animation?.stop(); };
  }, [scale]);
  return scale;
}

function PredictionRange({ min, max }: { min: number; max: number }) { const local = useLocal(); const ui = useStyles();
  const scale = useRangeReveal();
  const extent = Math.max(Math.abs(min), Math.abs(max), 1);
  const position = (value: number) => ((value + extent) / (extent * 2)) * 100;
  const left = position(Math.min(min, max));
  const width = Math.max(position(Math.max(min, max)) - left, 3);
  const endpoint = Math.round(extent);
  return <View accessible accessibilityRole="image" accessibilityLabel={`Expected change range ${signedPercent(min)} to ${signedPercent(max)}`} style={ui.stack}>
    <View style={local.track}>
      <View style={local.zero} />
      <Animated.View style={[local.range, { left: `${left}%`, width: `${width}%`, transformOrigin: 'left', transform: [{ scaleX: scale }] }]} />
    </View>
    <View accessible={false} style={local.ends}>
      <Copy style={local.end}>{signedPercent(-endpoint)}</Copy>
      <Copy style={local.end}>0%</Copy>
      <Copy style={local.end}>{signedPercent(endpoint)}</Copy>
    </View>
  </View>;
}

/** The original forecast, shown as a range with its confidence level and never as a single number. */
export function Forecast({ prediction, metrics }: { prediction: Prediction; metrics: Metric[] }) { const local = useLocal(); const ui = useStyles();
  const label = metrics.find(metric => metric.key === prediction.target_metric)?.label ?? prediction.target_metric;
  return <View style={local.card}>
    <Copy style={local.eyebrow}>We predict</Copy>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>{label} is {DIRECTION[prediction.direction]}</Copy>
    <Copy style={local.value}>{signedPercent(prediction.expected_change_min)} to {signedPercent(prediction.expected_change_max)}</Copy>
    <PredictionRange min={prediction.expected_change_min} max={prediction.expected_change_max} />
    <Copy>Confidence: {prediction.confidence.charAt(0).toUpperCase() + prediction.confidence.slice(1)}</Copy>
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
  track: { height: SPACING.md, borderRadius: RADII.pill, backgroundColor: COLORS.line, overflow: 'hidden' },
  zero: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.muted },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: RADII.pill, backgroundColor: COLORS.night },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  end: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
}); });
