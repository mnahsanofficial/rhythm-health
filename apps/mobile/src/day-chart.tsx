import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { ChartData, ChartPoint } from '@rhythm-health/contract';
import { Copy, useStyles } from './ui';
import { useColors, themedStyles } from './theme-core';

const HEIGHT = LAYOUT.primaryAction * 5;
const DOT = SPACING.xs + 2;
const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const listDays = (days: number[]) => `${days.length === 1 ? 'day' : 'days'} ${days.join(', ')}`;
type Plotted = ChartPoint & { value: number };

/**
 * The primary metric day by day, drawn only from the backend's chart data. A missed day breaks the
 * line and every planned day keeps its place. The rows below are the text alternative and the
 * screen-reader route, so the narrow columns over the plot stay touch-only.
 */
export function DayChart({ chart , part = 'plot' }: { chart: ChartData ; part?: 'plot' | 'days' }) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const [width, setWidth] = useState(300);
  const [open, setOpen] = useState<number | null>(null);
  const metric = chart.primary_metric;
  const total = chart.baseline_days + chart.intervention_days;
  const days = Array.from({ length: total }, (_, index) => index + 1);
  const byDay = new Map(chart.points.map(point => [point.day, point]));
  const points = chart.points.filter((point): point is Plotted => point.logged && point.value !== null && point.value !== undefined);
  const missed = chart.points.filter(point => !point.logged && point.missed).map(point => point.day);
  const notReached = days.filter(day => !byDay.get(day)?.logged && !missed.includes(day));
  const mean = chart.baseline_mean;
  const band = chart.predicted_band;

  const values = [...points.map(point => point.value), ...(mean !== null ? [mean] : []), ...(band ? [band.expected_value_min, band.expected_value_max] : [])];
  let lo = metric.type === 'scale' && metric.min !== null ? metric.min : Math.min(...values);
  let hi = metric.type === 'scale' && metric.max !== null ? metric.max : Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const x = (day: number) => ((day - 0.5) / total) * width;
  const y = (value: number) => HEIGHT - ((Math.min(Math.max(value, lo), hi) - lo) / (hi - lo)) * HEIGHT;
  const testStart = (chart.baseline_days / total) * width;

  const runs: Plotted[][] = [];
  for (const point of points) {
    const last = runs.at(-1);
    if (last && last.at(-1)!.day === point.day - 1) last.push(point);
    else runs.push([point]);
  }

  const summary = [
    `${metric.label} by day, days 1 to ${total}.`,
    mean !== null ? `Baseline average ${fmt(mean)}.` : 'No baseline average.',
    band ? `Predicted range ${fmt(band.expected_value_min)} to ${fmt(band.expected_value_max)}.` : 'No predicted range.',
    missed.length ? `Missed: ${listDays(missed)}.` : 'Missed: none.',
  ].join(' ');
  const selected = open === null ? undefined : byDay.get(open);
  const toggle = (day: number) => setOpen(current => current === day ? null : day);

  if (part === 'days') return <View style={ui.stack}>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>Day by day</Copy>
    {points.length > 0 && <View style={local.legend}>
      <Legend dot={<View style={[local.key, { backgroundColor: COLORS.night }]} />} text="Baseline day" />
      <Legend dot={<View style={[local.key, { backgroundColor: COLORS.moss }]} />} text="Made the change" />
      <Legend dot={<View style={[local.key, local.keyHollow]} />} text="Skipped the change" />
      {mean !== null && <Legend dot={<View style={local.keyLine} />} text={`Baseline average: ${fmt(mean)}`} />}
      {band && <Legend dot={<View style={local.keyBand} />} text={`Predicted range: ${fmt(band.expected_value_min)}–${fmt(band.expected_value_max)}`} />}
    </View>}
    {missed.length > 0 && <Copy style={local.small}>{`Missed: ${listDays(missed)}.`}</Copy>}
    {notReached.length > 0 && <Copy style={local.small}>{`Not reached before you finished: ${listDays(notReached)}.`}</Copy>}
    {selected && <DayDetails chart={chart} point={selected} />}
    <View>
      {days.map(day => <DayRow key={day} chart={chart} day={day} point={byDay.get(day)} missed={missed.includes(day)} open={open === day} onPress={() => toggle(day)} />)}
    </View>
  </View>;
  return <View style={ui.stack}>
    {points.length === 0 ? <Copy>Nothing was recorded for this measure, so there&apos;s no line to draw.</Copy> : <View accessible accessibilityRole="image" accessibilityLabel={summary} style={local.plotRow}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.axis}>
        <Copy maxFontSizeMultiplier={1.2} style={local.tick}>{fmt(hi)}</Copy>
        <Copy maxFontSizeMultiplier={1.2} style={local.tick}>{fmt(lo)}</Copy>
      </View>
      <View style={local.plotColumn} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.plot}>
          <Svg width={width} height={HEIGHT}>
            <Rect x={testStart} y={0} width={width - testStart} height={HEIGHT} fill={COLORS['moss-tint']} />
            {band && <Rect x={testStart} y={y(Math.max(band.expected_value_min, band.expected_value_max))} width={width - testStart}
              height={Math.abs(y(band.expected_value_min) - y(band.expected_value_max))} fill={COLORS['night-tint']} />}
            {mean !== null && <Line x1={0} x2={width} y1={y(mean)} y2={y(mean)} stroke={COLORS.muted} strokeWidth={1} strokeDasharray={`${SPACING.xs} ${SPACING.xs}`} />}
            {runs.filter(run => run.length > 1).map(run => <Polyline key={run[0].day} points={run.map(point => `${x(point.day)},${y(point.value)}`).join(' ')}
              fill="none" stroke={COLORS.muted} strokeWidth={LAYOUT.focusWidth} />)}
            {points.map(point => {
              const test = point.phase === 'intervention';
              const skipped = test && !point.intervention_completed;
              return <Circle key={point.day} cx={x(point.day)} cy={y(point.value)} r={open === point.day ? DOT + 2 : DOT}
                fill={skipped ? COLORS.paper : test ? COLORS.moss : COLORS.night} stroke={test ? COLORS.moss : COLORS.night} strokeWidth={LAYOUT.focusWidth} />;
            })}
          </Svg>
          <View style={local.columns}>
            {days.map(day => byDay.get(day)?.logged
              ? <Pressable key={day} accessible={false} style={local.column} onPress={() => toggle(day)} />
              : <View key={day} style={local.column} />)}
          </View>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.dayLabels}>
          {days.map(day => <Copy key={day} maxFontSizeMultiplier={1.2} style={[local.dayLabel, missed.includes(day) && local.dayMissed]}>{missed.includes(day) ? '×' : notReached.includes(day) ? '–' : day}</Copy>)}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={local.phases}>
          <Copy style={[local.phase, { width: `${(chart.baseline_days / total) * 100}%`, color: COLORS.night }]}>Baseline</Copy>
          <Copy style={[local.phase, { color: COLORS.moss }]}>Test</Copy>
        </View>
      </View>
    </View>}
  </View>;
}

function DayRow({ chart, day, point, missed, open, onPress }: { chart: ChartData; day: number; point?: ChartPoint; missed: boolean; open: boolean; onPress: () => void }) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const test = point ? point.phase === 'intervention' : day > chart.baseline_days;
  const phase = test ? 'test' : 'baseline';
  const value = point?.logged ? point.value : null;
  if (value === null || value === undefined) {
    const state = point?.logged ? 'no value' : missed ? 'missed' : 'not reached';
    return <View accessible accessibilityLabel={`Day ${day}, ${phase}: ${state}`} style={local.row}>
      <Copy accessible={false} style={missed ? local.rowMissed : ui.muted}>Day {day}</Copy>
      <Copy accessible={false} style={missed ? local.rowMissed : ui.muted}>{missed ? '× Missed' : state === 'no value' ? 'No value' : 'Not reached'}</Copy>
    </View>;
  }
  const skipped = test && !point?.intervention_completed;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Day ${day}, ${phase}${skipped ? ', change skipped' : ''}: ${fmt(value)}`} accessibilityState={{ expanded: open }} onPress={onPress}
    style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS['moss-tint'] }]}>
    <Copy>Day {day}{skipped ? ' · change skipped' : ''}</Copy>
    <Copy style={local.rowValue}>{fmt(value)}</Copy>
  </Pressable>;
}

function DayDetails({ chart, point }: { chart: ChartData; point: ChartPoint }) { const local = useLocal(); const ui = useStyles();
  const test = point.phase === 'intervention';
  return <View accessibilityLabel={`Details for day ${point.day}`} accessibilityLiveRegion="polite" style={local.details}>
    <Copy style={local.detailsTitle}>{`Day ${point.day} · ${test ? 'Test' : 'Baseline'}${test ? point.intervention_completed ? ' · made the change' : ' · skipped the change' : ''}`}</Copy>
    {chart.metrics.map(metric => {
      const value = point.values?.[metric.key];
      return value === undefined ? null : <View key={metric.key} style={local.detail}>
        <Copy style={ui.muted}>{metric.label}</Copy>
        <Copy style={local.rowValue}>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</Copy>
      </View>;
    })}
    {point.note && <Copy>“{point.note}”</Copy>}
  </View>;
}

function Legend({ dot, text }: { dot: React.ReactNode; text: string }) { const local = useLocal();
  return <View style={local.legendItem}>{dot}<Copy style={local.small}>{text}</Copy></View>;
}

const useLocal = themedStyles((COLORS, mode) => { const ui = useStyles.forMode(mode); return StyleSheet.create({
  plotRow: { flexDirection: 'row', gap: SPACING.xs },
  axis: { height: HEIGHT, justifyContent: 'space-between', alignItems: 'flex-end', minWidth: SPACING.lg },
  tick: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  plotColumn: { flex: 1, minWidth: 0 },
  plot: { height: HEIGHT, overflow: 'hidden' },
  columns: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  column: { flex: 1 },
  dayLabels: { flexDirection: 'row', marginTop: SPACING.xs },
  dayLabel: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, flex: 1, textAlign: 'center' },
  dayMissed: { color: COLORS.clay },
  phases: { flexDirection: 'row', marginTop: SPACING.xs },
  phase: { ...NATIVE_TYPOGRAPHY.caption },
  legend: { gap: SPACING.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  key: { width: SPACING.md - SPACING.xs, height: SPACING.md - SPACING.xs, borderRadius: RADII.pill },
  keyHollow: { backgroundColor: COLORS.paper, borderWidth: LAYOUT.focusWidth, borderColor: COLORS.moss },
  keyLine: { width: SPACING.md, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.muted },
  keyBand: { width: SPACING.md, height: SPACING.md - SPACING.xs, backgroundColor: COLORS['night-tint'] },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  row: { minHeight: LAYOUT.primaryAction, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingVertical: SPACING.xs, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  rowValue: { ...ui.number, color: COLORS.ink },
  rowMissed: { color: COLORS.clay },
  details: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  detailsTitle: { color: COLORS.moss },
  detail: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm },
}); });
