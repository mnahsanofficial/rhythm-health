import { StyleSheet, View } from 'react-native';
import { NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { DayData } from './today';
import { Action, Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

/** The one thing to do now: check in, wait for tomorrow, finish, or read the results. */
export function TodayCard({ data: { experiment, timeline }, disabled, onCheckin, onOpenReport }: {
  data: DayData; disabled: boolean; onCheckin: () => void; onOpenReport: () => void;
}) { const local = useLocal(); const styles = useStyles();
  const { progress } = timeline;
  if (experiment.is_seeded && progress.state !== 'in_progress') return <View style={local.plain}><Copy>This sample has ended. Remove it to free up a slot for a real experiment.</Copy></View>;
  if (progress.state === 'completed') return <View style={styles.decision}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>Your results are ready.</Copy>
    <Copy style={styles.muted}>See what changed, and how close the prediction was.</Copy>
    <Action label="See your Lab Report" onPress={onOpenReport} />
  </View>;
  if (progress.state === 'ended') return <View style={styles.decision}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>{`All ${progress.total_days} days are done.`}</Copy>
    <Copy style={styles.muted}>Finish the experiment to see what your check-ins show.</Copy>
  </View>;
  if (progress.state === 'not_started' || progress.day_number === null) return <View style={local.plain}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>This experiment hasn&apos;t started.</Copy>
    <Copy style={styles.muted}>Nothing to check in yet.</Copy>
  </View>;

  const day = progress.day_number;
  const done = timeline.days.some(entry => entry.day_number === day && entry.state === 'recorded');
  const opens = timeline.next_day_at ? new Date(timeline.next_day_at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : null;
  if (done) return <View style={styles.decision}>
    <View style={local.doneRow}><Copy accessible={false} style={local.done}>✓</Copy><Copy style={local.done}>Done for today</Copy></View>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>{`Day ${day} is recorded.`}</Copy>
    <Copy style={styles.muted}>{opens && progress.days_remaining ? `Day ${day + 1} opens ${opens}.` : "That was the last day. Finish when you're ready."}</Copy>
    <Action label="Edit answers" secondary disabled={disabled} onPress={onCheckin} />
  </View>;
  return <View style={styles.decision}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>Today&apos;s check-in is waiting.</Copy>
    <Copy style={styles.muted}>{`${progress.phase === 'intervention' ? 'A test day: tell us whether you made the change, then how it went.' : 'A baseline day: just record a normal day.'} About 30 seconds.`}</Copy>
    <Action label={`Check in for day ${day}`} disabled={disabled} onPress={onCheckin} />
    {opens && <Copy style={local.small}>{`Day ${day} closes ${opens}.`}</Copy>}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  plain: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  doneRow: { flexDirection: 'row', gap: SPACING.sm },
  done: { color: COLORS.moss },
}));
