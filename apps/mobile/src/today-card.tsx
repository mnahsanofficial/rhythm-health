import { StyleSheet, View } from 'react-native';
import { NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { isLastBaselineDay, testStartsLine } from './lib/experiments';
import type { LabReport } from '@rhythm-health/contract';
import { allDaysDone, FinishNow } from './finish';
import type { DayData } from './today';
import { Action, Copy, useStyles } from './ui';
import { Icon } from './icons';
import { themedStyles, useColors } from './theme-core';

/** The one thing to do now: check in, wait for tomorrow, finish, or read the results. */
export function TodayCard({ data: { experiment, timeline }, disabled, token, offline, onExpired, onCompleted, onCheckin, onOpenReport }: {
  data: DayData; disabled: boolean; token: string; offline: boolean; onExpired: () => void; onCompleted: (report: LabReport) => void; onCheckin: () => void; onOpenReport: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const { progress } = timeline;
  if (experiment.is_seeded && progress.state !== 'in_progress') return <View style={local.plain}><Copy>This sample has ended. Remove it to free up a slot for a real experiment.</Copy></View>;
  if (progress.state === 'completed') return <View style={styles.decision}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>Your results are ready.</Copy>
    <Copy>See what changed, and how close the prediction was.</Copy>
    <Action label="See your Lab Report" onPress={onOpenReport} />
  </View>;
  const allDone = <>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>{`All ${progress.total_days} days are done.`}</Copy>
    <Copy>See what your check-ins show.</Copy>
    <FinishNow experiment={experiment} token={token} offline={offline} disabled={disabled} onExpired={onExpired} onCompleted={onCompleted} />
  </>;
  if (progress.state === 'ended') return <View style={styles.decision}>{allDone}</View>;
  if (progress.state === 'not_started' || progress.day_number === null) return <View style={local.plain}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>This experiment hasn&apos;t started.</Copy>
    <Copy>Nothing to check in yet.</Copy>
  </View>;

  const day = progress.day_number;
  const done = timeline.days.some(entry => entry.day_number === day && entry.state === 'recorded');
  const opens = timeline.next_day_at ? new Date(timeline.next_day_at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : null;
  if (done && !experiment.is_seeded && allDaysDone(timeline)) return <View style={styles.decision}>
    {allDone}
    <Action label="Edit answers" secondary disabled={disabled} onPress={onCheckin} />
  </View>;
  if (done) return <View style={styles.decision}>
    <View testID="recorded-check" accessible accessibilityRole="image" accessibilityLabel={`Day ${day} recorded`} style={local.check}><Icon name="check" color={COLORS.moss} filled /></View>
    {isLastBaselineDay(timeline) && <Copy>{`Baseline done. ${testStartsLine(experiment.intervention.action, timeline.next_day_at)}`}</Copy>}
    <Copy style={local.small}>{opens && progress.days_remaining ? `Day ${day + 1} opens ${opens}` : "That was the last day. Finish when you're ready."}</Copy>
    <Action label="Edit answers" secondary disabled={disabled} onPress={onCheckin} />
  </View>;
  return <View style={styles.decision}>
    {opens && <Copy style={local.small}>{`Closes ${opens}`}</Copy>}
    <Action wide label="Check in now" name={`Check in now, day ${day}`} disabled={disabled} onPress={onCheckin} />
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  plain: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  check: { alignSelf: 'flex-start' },
}));
