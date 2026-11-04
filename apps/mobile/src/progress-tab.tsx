import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { MetricTrend, ProgressSummary } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { getProgressSummary } from './lib/progress-summary';
import { reportPercent } from './lib/reports';
import { Observations } from './progress';
import type { DayData } from './today';
import { Action, Alert, Copy, Status, Title, useStepFocus, useStyles } from './ui';
import { themedStyles } from './theme-core';

const shown = (value: number | null | undefined, type: string) => {
  if (value === null || value === undefined) return 'not enough data';
  return type === 'boolean' ? `${Math.round(value * 100)}% of days` : String(Number(value.toFixed(1)));
};
const moved = (change: number) => change === 0
  ? 'Your normal has stayed the same since your first experiment.'
  : `Your normal has moved ${change > 0 ? '+' : ''}${Number(change.toFixed(1))} since your first experiment.`;

/** Every number here comes from the server. This only puts words around them. */
function MetricCard({ metric, example = false }: { metric: MetricTrend; example?: boolean }) { const local = useLocal(); const ui = useStyles();
  return <View testID={`${example ? 'example' : 'metric'}-${metric.key}`} style={local.card}>
    <Copy style={ui.sectionTitle}>{metric.label}</Copy>
    {metric.runs.map(run => <View key={run.experiment_id} style={local.run}>
      <Copy style={local.caption}>{run.question}</Copy>
      <Copy>{`Normal ${shown(run.baseline_mean, metric.type)} → with the change ${shown(run.result_mean, metric.type)}${run.percent_change === null || run.percent_change === undefined ? '' : ` (${reportPercent(run.percent_change)})`}`}</Copy>
    </View>)}
    {metric.normal_change !== null && metric.normal_change !== undefined && <Copy>{moved(metric.normal_change)}</Copy>}
  </View>;
}

/** What's finished, compared, then what's running, day by day. */
export function ProgressScreen({ entries, updatedAt, token, offline, onExpired, onAsk }: { entries: DayData[] | null; updatedAt?: Date; token: string; offline: boolean; onAsk: () => void; onExpired: () => void }) { const local = useLocal(); const ui = useStyles();
  const heading = useStepFocus('progress');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (offline) return;
    let active = true;
    getProgressSummary(token).then(value => { if (active) { setSummary(value); setError(null); } }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load your progress. Try again.");
    });
    return () => { active = false; };
    // A refreshed token is not a reason to read again; `attempt` is the explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, attempt]);
  return <View style={ui.stack}>
    <Title textRef={heading}>Progress</Title>
    {offline && updatedAt && <Status>{`Offline, last updated ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`}</Status>}
    {entries === null && <Copy>{offline ? 'Reconnect to load your progress.' : 'Loading your progress…'}</Copy>}
    {(entries?.length === 0 && !summary?.example && !summary?.metrics.length) && <>
      <Copy>Nothing running yet.</Copy>
      <Action label="Ask a question" disabled={offline} onPress={onAsk} />
    </>}
    {error && <><Alert>{error}</Alert><Action label="Try again" secondary disabled={offline} onPress={() => { setError(null); setAttempt(n => n + 1); }} /></>}
    {!!summary?.kept.length && <View style={ui.stack}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Habits I kept</Copy>
      {summary.kept.map(item => <View key={item.experiment_id} style={local.card}><Copy>{item.habit}</Copy><Copy style={local.caption}>{item.question}</Copy></View>)}
    </View>}
    {!!summary?.metrics.length && <View style={ui.stack}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Your experiments compared</Copy>
      {summary.metrics.map(metric => <MetricCard key={`${metric.key}:${metric.type}`} metric={metric} />)}
    </View>}
    {summary?.example && <View testID="progress-example" style={local.example}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Example</Copy>
      <Copy>Invented check-ins. Never counted.</Copy>
      <Copy style={local.caption}>{summary.example.question}</Copy>
      {summary.example.metrics.map(metric => <MetricCard key={`${metric.key}:${metric.type}`} metric={metric} example />)}
    </View>}
    {summary && (summary.metrics.length > 0 || summary.example) && <Copy>Changing several things over time means this shows trends, not proof.</Copy>}
    {entries?.map(entry => <View key={entry.experiment.id} style={ui.stack}>
      <Copy style={ui.sectionTitle}>{entry.experiment.question}</Copy>
      <Observations data={entry} title="Day by day" token={token} offline={offline} onExpired={onExpired} />
    </View>)}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  card: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.surface },
  run: { gap: SPACING.xs },
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  example: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS['night-tint'] },
}));
