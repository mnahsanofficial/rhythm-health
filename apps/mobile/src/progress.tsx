import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Checkin, ExperimentDay, MetricValue } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { listCheckins } from './lib/checkins';
import { Action, Alert, Copy, Loading, styles, Status } from './ui';
import type { DayData } from './today';

const STATE_WORDS: Record<ExperimentDay['state'], string> = {
  recorded: 'logged', current: 'today, not logged yet', missed: 'missed', not_observed: 'not recorded before completion', future: 'upcoming',
};
const shown = (value: MetricValue) => typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);

/** "Your observations": server-owned counts and day states, with recorded answers read beside them. */
export function Observations({ data: { experiment, timeline }, title, token, offline, onExpired }: {
  data: DayData; title: string; token: string; offline: boolean; onExpired: () => void;
}) {
  const latest = [...timeline.days].reverse().find(day => day.state === 'recorded')?.day_number;
  const [selected, setSelected] = useState(latest);
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
  const day = timeline.days.find(value => value.day_number === selected && value.state === 'recorded')?.day_number ?? latest;
  const recorded = answers?.find(value => value.day_number === day);
  const testDays = answers?.filter(value => value.phase === 'intervention') ?? [];
  const followed = testDays.filter(value => value.intervention_completed).length;
  return <View style={styles.divider}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>{title}</Copy>
    <Copy style={styles.number}>{`${timeline.recorded_days} of ${progress.total_days} days recorded`}</Copy>
    {progress.state === 'in_progress' && <Copy style={local.small}>{`${progress.phase === 'baseline' ? 'Baseline' : 'Test'} day ${progress.phase_day} of ${progress.phase_days} · ${progress.days_remaining} days remaining`}</Copy>}
    {testDays.length > 0 && <Copy style={local.small}>{`Change made on ${followed} of ${testDays.length} test days`}</Copy>}
    {experiment.is_seeded && <Copy style={local.small}>Sample check-ins for demonstration. These answers are excluded from your real experiment history.</Copy>}
    <View style={local.grid}>
      {timeline.days.map(item => <DayCell key={item.day_number} item={item} isToday={item.state === 'current' || (progress.state === 'in_progress' && item.day_number === progress.day_number)} open={day === item.day_number} onPress={() => setSelected(item.day_number)} />)}
    </View>
    <View style={local.legend}>
      <View style={local.legendItem}><View style={[local.key, { backgroundColor: COLORS.night }]} /><Copy style={local.small}>Baseline</Copy></View>
      <View style={local.legendItem}><View style={[local.key, { backgroundColor: COLORS.moss }]} /><Copy style={local.small}>Test</Copy></View>
      <Copy style={local.small}>✓ logged · – missed · tap a logged day to see it</Copy>
    </View>
    <Copy style={local.small}>Missed days can&apos;t be filled in.</Copy>
    {timeline.days.some(item => item.state === 'not_observed') && <Copy style={local.small}>Not observed: the experiment finished before these days were observed. They are not counted as missed.</Copy>}
    {!hasRecorded ? <Copy style={styles.muted}>No days recorded yet. Your next check-in will start the record.</Copy> : <>
      {offline && answers === null ? <Copy>No connection. Reconnect to load recorded answers.</Copy>
        : answers === null && !error ? <Loading message="Loading recorded answers…" /> : null}
      {error && <><Alert>{error}</Alert><Action label="Retry answers" secondary disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>}
      {busy && answers !== null && <Status style={local.small}>Refreshing recorded answers…</Status>}
      {answers !== null && (recorded ? <View accessibilityLabel={`Day ${recorded.day_number} answers`} accessibilityLiveRegion="polite" style={local.panel}>
        <Copy style={local.panelTitle}>{`Day ${recorded.day_number} · ${recorded.phase === 'intervention' ? 'Test' : 'Baseline'}`}</Copy>
        {recorded.phase === 'intervention' && <View style={local.answer}><Copy style={styles.muted}>Made the change</Copy><Copy>{recorded.intervention_completed ? 'Yes' : 'No'}</Copy></View>}
        {experiment.metrics.map(metric => {
          const value = recorded.metric_values[metric.key];
          return value === undefined ? null : <View key={metric.key} style={local.answer}>
            <Copy style={styles.muted}>{metric.label}</Copy>
            <Copy style={local.value}>{`${shown(value)}${metric.type === 'scale' && metric.max !== null ? `/${metric.max}` : ''}`}</Copy>
          </View>;
        })}
        {recorded.note && <Copy>“{recorded.note}”</Copy>}
      </View> : <><Copy>No answers returned for this day.</Copy><Action label="Retry answers" secondary disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>)}
    </>}
  </View>;
}

function DayCell({ item, isToday, open, onPress }: { item: ExperimentDay; isToday: boolean; open: boolean; onPress: () => void }) {
  const baseline = item.phase === 'baseline';
  const recorded = item.state === 'recorded';
  const missed = item.state === 'missed';
  const label = `Day ${item.day_number}, ${baseline ? 'baseline' : 'test'}, ${STATE_WORDS[item.state]}`;
  const ink = recorded ? COLORS.paper : missed ? COLORS.muted : COLORS[baseline ? 'night' : 'moss'];
  const circle = <View style={[local.ring, open && recorded ? { borderColor: COLORS.sun } : isToday && { borderColor: COLORS.ink }]}>
    <View style={[local.circle, missed ? local.missed : { backgroundColor: recorded ? COLORS[baseline ? 'night' : 'moss'] : COLORS[baseline ? 'night-tint' : 'moss-tint'] }]}>
      <Copy accessible={false} maxFontSizeMultiplier={1.2} style={[local.mark, { color: ink }]}>{recorded ? '✓' : missed ? '–' : item.day_number}</Copy>
    </View>
  </View>;
  return <View style={local.cell}>
    {recorded
      ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: open }} onPress={onPress} style={local.target}>{circle}</Pressable>
      : <View accessible accessibilityLabel={label} style={local.target}>{circle}</View>}
    <Copy accessibilityElementsHidden importantForAccessibility="no-hide-descendants" maxFontSizeMultiplier={1.2} style={local.dayName}>Day {item.day_number}</Copy>
    {isToday && <Copy maxFontSizeMultiplier={1.2} style={local.today}>Today</Copy>}
  </View>;
}

const SIZE = SPACING.xl + SPACING.sm;
const local = StyleSheet.create({
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACING.sm },
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
  panel: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  panelTitle: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  answer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  value: { ...styles.number, color: COLORS.ink },
});
