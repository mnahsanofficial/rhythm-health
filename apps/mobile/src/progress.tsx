import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Checkin, ExperimentDay } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { listCheckins } from './lib/checkins';
import { metricName, metricValue } from './lib/short-labels';
import { Action, Alert, Copy, Loading, useStyles, Status, CountUp } from './ui';
import type { DayData } from './today';
import { useColors, themedStyles } from './theme-core';

const STATE_WORDS: Record<ExperimentDay['state'], string> = {
  recorded: 'logged', current: 'today, not logged yet', missed: 'missed', not_observed: 'not recorded before completion', future: 'upcoming',
};

/** "Your observations": server-owned counts and day states, with recorded answers read beside them. */
export function Observations({ data: { experiment, timeline }, title, compact = false, token, offline, onExpired }: {
  data: DayData; title?: string; /** One row of small dots and a count, for a list of experiments. */ compact?: boolean; token: string; offline: boolean; onExpired: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const [selected, setSelected] = useState<number>();
  const [answers, setAnswers] = useState<Checkin[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const hasRecorded = timeline.recorded_days > 0;
  const load = useCallback(async (active: () => boolean) => {
    if (offline || !hasRecorded) return;
    setBusy(true); setError(undefined);
    try { const values = await listCheckins(token, experiment.id); if (active()) setAnswers(values); }
    catch (cause) {
      if (!active()) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load recorded answers. Try again.");
    } finally { if (active()) setBusy(false); }
  }, [token, experiment.id, offline, hasRecorded, onExpired]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(() => active); });
    return () => { active = false; };
  }, [load, attempt, timeline]);

  const { progress } = timeline;
  const day = timeline.days.find(value => value.day_number === selected && value.state === 'recorded')?.day_number;
  const recorded = answers?.find(value => value.day_number === day);
  return <View style={styles.divider}>
    {title && <Copy accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle}>{title}</Copy>}
    {compact ? <View style={local.compactRow}>
      <View testID="day-dots" style={local.dots}>
        {timeline.days.map(item => <DayDot key={`${experiment.id}:${item.day_number}`} item={item} isToday={item.state === 'current' || (progress.state === 'in_progress' && item.day_number === progress.day_number)} open={day === item.day_number} onPress={() => setSelected(item.day_number)} />)}
      </View>
      <View accessible accessibilityLabel={`${timeline.recorded_days} of ${progress.total_days} days recorded`}><CountUp value={timeline.recorded_days} suffix={`/${progress.total_days}`} /></View>
    </View> : <CountUp value={timeline.recorded_days} suffix={` of ${progress.total_days} days recorded`} />}
    {experiment.is_seeded && <Copy style={local.small}>Sample check-ins. Never counted.</Copy>}
    {!compact && <View style={local.grid}>
      {timeline.days.map(item => <DayCell key={`${experiment.id}:${item.day_number}`} item={item} isToday={item.state === 'current' || (progress.state === 'in_progress' && item.day_number === progress.day_number)} open={day === item.day_number} onPress={() => setSelected(item.day_number)} />)}
    </View>}
    <View style={local.legend}>
      <View style={local.legendItem}><View style={[local.key, { backgroundColor: COLORS.night }]} /><Copy style={local.small}>Baseline</Copy></View>
      <View style={local.legendItem}><View style={[local.key, { backgroundColor: COLORS.moss }]} /><Copy style={local.small}>Test</Copy></View>
    </View>
    {timeline.days.some(item => item.state === 'not_observed') && <Copy style={local.small}>Not observed: the experiment finished before these days were observed. They are not counted as missed.</Copy>}
    {!hasRecorded ? !compact && <Copy style={styles.muted}>No days recorded yet. Your next check-in will start the record.</Copy> : <>
      {offline && answers === null ? <Copy>No connection. Reconnect to load recorded answers.</Copy>
        : answers === null && !error ? <Loading message="Loading recorded answers…" /> : null}
      {error && <><Alert>{error}</Alert><Action label="Try again" secondary disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>}
      {busy && answers !== null && <Status style={local.small}>Refreshing recorded answers…</Status>}
      {answers !== null && day !== undefined && (recorded ? <View accessibilityLabel={`Day ${recorded.day_number} answers`} accessibilityLiveRegion="polite" style={local.panel}>
        <Copy style={local.panelTitle}>{`Day ${recorded.day_number} · ${recorded.phase === 'intervention' ? 'Test' : 'Baseline'}`}</Copy>
        {recorded.phase === 'intervention' && <View style={local.answer}><Copy style={styles.muted}>Made the change</Copy><Copy>{recorded.intervention_completed ? 'Yes' : 'No'}</Copy></View>}
        {experiment.metrics.map(metric => {
          const value = recorded.metric_values[metric.key];
          return value === undefined ? null : <View key={metric.key} style={local.answer}>
            <Copy style={styles.muted}>{metricName(metric)}</Copy>
            <Copy style={typeof value === 'boolean' ? undefined : local.value}>{metricValue(metric, value)}</Copy>
          </View>;
        })}
        {recorded.note && <Copy style={local.note}>“{recorded.note}”</Copy>}
      </View> : <><Copy>No answers returned for this day.</Copy><Action label="Try again" secondary disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>)}
    </>}
  </View>;
}

function DayCell({ item, isToday, open, onPress }: { item: ExperimentDay; isToday: boolean; open: boolean; onPress: () => void }) { const COLORS = useColors(); const local = useLocal();
  const baseline = item.phase === 'baseline';
  const recorded = item.state === 'recorded';
  const missed = item.state === 'missed';
  const label = `Day ${item.day_number}, ${baseline ? 'baseline' : 'test'}, ${STATE_WORDS[item.state]}`;
  const ink = recorded ? COLORS['on-accent'] : missed ? COLORS.muted : COLORS[baseline ? 'night' : 'moss'];
  const circle = <View style={[local.ring, open && recorded ? { borderColor: COLORS.text } : isToday && { borderColor: COLORS.ink }]}>
    <View style={[local.circle, missed ? local.missed : { backgroundColor: recorded ? COLORS[baseline ? 'night' : 'moss'] : COLORS[baseline ? 'night-tint' : 'moss-tint'] }]}>
      <Copy accessible={false} maxFontSizeMultiplier={1.2} style={[local.mark, { color: ink }]}>{recorded ? '✓' : missed ? '–' : ''}</Copy>
    </View>
  </View>;
  return <View style={local.cell}>
    {recorded
      ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: open }} onPress={onPress} style={local.target}>{circle}</Pressable>
      : <View accessible accessibilityLabel={label} style={local.target}>{circle}</View>}
    <Copy accessibilityElementsHidden importantForAccessibility="no-hide-descendants" maxFontSizeMultiplier={1.2} style={local.dayName}>{item.day_number}</Copy>
    {isToday && <Copy maxFontSizeMultiplier={1.2} style={local.today}>Today</Copy>}
  </View>;
}

/** The same day in a small row: smaller to see, and just as easy to tap. */
function DayDot({ item, isToday, open, onPress }: { item: ExperimentDay; isToday: boolean; open: boolean; onPress: () => void }) { const COLORS = useColors(); const local = useLocal();
  const baseline = item.phase === 'baseline';
  const recorded = item.state === 'recorded';
  const missed = item.state === 'missed';
  const label = `Day ${item.day_number}, ${baseline ? 'baseline' : 'test'}, ${STATE_WORDS[item.state]}`;
  const phase = COLORS[baseline ? 'night' : 'moss'];
  const dot = <View testID="day-dot" style={[local.dot, missed ? local.missed : { borderColor: phase, backgroundColor: recorded ? phase : 'transparent' }, (open && recorded) || isToday ? local.dotNow : null]}>
    {(recorded || missed) && <Text accessible={false} allowFontScaling={false} style={[local.dotMark, { color: recorded ? COLORS['on-accent'] : COLORS.muted }]}>{recorded ? '✓' : '–'}</Text>}
  </View>;
  return recorded
    ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: open }} onPress={onPress} hitSlop={SPACING.sm} style={local.dotCell}>{dot}</Pressable>
    : <View accessible accessibilityLabel={label} style={local.dotCell}>{dot}</View>;
}

const SIZE = SPACING.xl + SPACING.sm;
const useLocal = themedStyles((COLORS, mode) => { const styles = useStyles.forMode(mode); return StyleSheet.create({
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACING.sm },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  dots: { flex: 1, flexDirection: 'row' },
  dotCell: { flex: 1, minHeight: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  dot: { width: SPACING.md, height: SPACING.md, borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth / 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dotNow: { borderColor: COLORS.ink, borderWidth: LAYOUT.focusWidth },
  dotMark: { fontSize: SPACING.sm + SPACING.xs / 2, lineHeight: SPACING.md - 2 },
  cell: { width: '20%', alignItems: 'center' },
  target: { minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction, alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 2, borderRadius: RADII.pill, borderWidth: LAYOUT.focusWidth, borderColor: 'transparent' },
  circle: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill },
  missed: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.muted },
  mark: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  dayName: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, textAlign: 'center' },
  today: { ...NATIVE_TYPOGRAPHY.caption, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: SPACING.md, rowGap: SPACING.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  key: { width: SPACING.sm + 2, height: SPACING.sm + 2, borderRadius: RADII.pill },
  panel: { paddingTop: SPACING.md, gap: SPACING.sm, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  panelTitle: NATIVE_TYPOGRAPHY.caption,
  answer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  value: { ...styles.number, color: COLORS.ink },
  note: { paddingTop: SPACING.sm, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
}); });
