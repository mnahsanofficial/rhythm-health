import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { COLORS, LAYOUT, SPACING } from '@rhythm-health/brand';
import type { Checkin, ExperimentDay } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { listCheckins } from './lib/checkins';
import { Action, Alert, Copy, Loading, styles, Title } from './ui';
import type { DayData } from './today';
const labels: Record<ExperimentDay['state'], string> = {
  recorded: 'Recorded', missed: 'Missed', current: 'Today', future: 'Coming up', not_observed: 'Not observed',
};
const symbols: Record<ExperimentDay['state'], string> = { recorded: '✓', missed: '—', current: '●', future: '○', not_observed: '/' };

export function Progress({ data: { experiment, timeline }, token, offline, onExpired }: {
  data: DayData; token: string; offline: boolean; onExpired: () => void;
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
  const day = timeline.days.find(value => value.day_number === selected && value.state === 'recorded')?.day_number ?? latest;
  const recorded = answers?.find(value => value.day_number === day);
  const details = <View style={[styles.stack, { paddingVertical: SPACING.md }]}>
        {offline && answers === null ? <Copy>No connection. Reconnect to load recorded answers.</Copy>
          : answers === null && !error ? <Loading message="Loading recorded answers…" /> : null}
        {error && <><Alert>{error}</Alert><Action label="Retry answers" disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>}
        {busy && answers !== null && <Copy accessibilityLiveRegion="polite">Refreshing recorded answers…</Copy>}
        {answers !== null && (recorded ? <View style={styles.stack}>
          <Copy accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.sectionTitle}>Day {day} answers</Copy>
          {recorded.phase === 'intervention' && <Copy>Made the change: {recorded.intervention_completed ? 'Yes' : 'Not today'}</Copy>}
          {experiment.metrics.map(metric => {
            const value = recorded.metric_values[metric.key];
            const display = value === undefined ? 'Not recorded' : typeof value === 'boolean' ? value ? 'Yes' : 'No'
              : metric.type === 'duration' ? `${value} minutes` : metric.type === 'scale' ? `${value} of ${metric.max ?? 10}` : String(value);
            return <Copy key={metric.key}>{metric.label}: {display}</Copy>;
          })}
          <Copy style={styles.muted}>{recorded.note || 'No note for this day.'}</Copy>
        </View> : <><Copy>No answers returned for this day.</Copy><Action label="Retry answers" disabled={offline || busy} onPress={() => setAttempt(value => value + 1)} /></>)}
    </View>;
  return <View style={styles.stack}>
    <Title>Your progress.</Title>
    <Copy style={styles.sectionTitle}>{timeline.recorded_days} of {timeline.progress.total_days} recorded</Copy>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg }}>
      <Copy>{timeline.missed_days} missed</Copy><Copy>{timeline.remaining_days} remaining</Copy>
    </View>
    <Copy style={styles.muted}>Each recorded day adds to your own evidence. A short experiment shows a pattern, not proof.</Copy>
    {offline && <Copy accessibilityLiveRegion="polite">Offline. Showing the last loaded progress.</Copy>}
    <View style={styles.divider}>
      <Copy accessibilityRole="header" style={styles.sectionTitle}>The days so far</Copy>
      <Copy style={styles.muted}>Tap a recorded day to see its answers. These answers are read-only.</Copy>
      {!hasRecorded && <Copy>No days recorded yet. Your next check-in will start the record.</Copy>}
      {timeline.days.map(item => {
        const phase = item.phase === 'baseline' ? 'Baseline' : 'Test';
        const text = `Day ${item.day_number} · ${phase} · ${labels[item.state]}`;
        const content = <><Copy accessible={false} style={{ color: item.state === 'recorded' ? COLORS.moss : COLORS.muted }}>{symbols[item.state]}</Copy><Copy>{text}</Copy></>;
        const row = { minHeight: LAYOUT.primaryAction, flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line };
        return item.state === 'recorded' ? <View key={item.day_number}><Pressable accessibilityRole="button"
          accessibilityLabel={`Day ${item.day_number}, ${phase}, Recorded`} accessibilityState={{ selected: day === item.day_number, expanded: day === item.day_number }}
          onPress={() => setSelected(item.day_number)} style={({ pressed }) => [row, (pressed || day === item.day_number) && { backgroundColor: COLORS['moss-tint'] }]}>{content}</Pressable>{day === item.day_number && details}</View>
          : <View key={item.day_number} style={row}>{content}</View>;
      })}
      <Copy style={styles.muted}>Missed days can&apos;t be filled in.</Copy>
      {timeline.days.some(item => item.state === 'not_observed') && <Copy style={styles.muted}>Not observed: the experiment finished before these days were observed. They are not counted as missed.</Copy>}
    </View>
  </View>;
}
