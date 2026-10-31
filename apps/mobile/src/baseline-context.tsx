import { View } from 'react-native';
import type { ExperimentTimeline } from '@rhythm-health/contract';
import { Copy, styles } from './ui';

export function BaselineContext({ timeline }: { timeline: ExperimentTimeline }) {
  const summary = timeline.baseline_summary;
  if (!summary || timeline.progress.state !== 'in_progress' || timeline.progress.phase !== 'intervention') return null;
  return <View style={styles.divider}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>Your normal, before the change.</Copy>
    {summary.days_recorded === 0 ? <Copy style={styles.muted}>No normal-day answers were recorded. There is no personal baseline to compare with yet.</Copy> : <>
      <Copy style={styles.muted}>{summary.days_recorded} of {summary.days_planned} normal {summary.days_planned === 1 ? 'day' : 'days'} recorded.</Copy>
      {summary.metrics.map(metric => <Copy key={metric.key}>{metric.description}</Copy>)}
      {summary.days_recorded < summary.days_planned && <Copy style={styles.muted}>Some normal days are missing, so this starting point is limited.</Copy>}
    </>}
  </View>;
}
