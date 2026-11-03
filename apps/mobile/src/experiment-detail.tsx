import { StyleSheet, View } from 'react-native';
import { COLORS, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { LabReport } from '@rhythm-health/contract';
import { BaselineContext } from './baseline-context';
import { FinishCard } from './finish';
import { Forecast } from './forecast';
import { Observations } from './progress';
import { TodayCard } from './today-card';
import type { DayData } from './today';
import { BackLink, Copy, styles, Title, useStepFocus } from './ui';

/** The experiment page: where it stands, finishing, every day, the plan and the forecast kept from the start. */
export function ExperimentDetail({ data, token, offline, disabled, onExpired, onBack, onCheckin, onOpenReport, onCompleted }: {
  data: DayData; token: string; offline: boolean; disabled: boolean; onExpired: () => void; onBack: () => void; onCheckin: () => void; onOpenReport: () => void; onCompleted: (report: LabReport) => void;
}) {
  const { experiment, timeline } = data;
  const { progress } = timeline;
  const heading = useStepFocus('experiment');
  const status = progress.state === 'in_progress'
    ? `Day ${progress.day_number} of ${progress.total_days} · ${progress.phase === 'intervention' ? 'Test' : 'Baseline'} day ${progress.phase_day} of ${progress.phase_days}`
    : progress.state === 'completed' ? 'Completed' : progress.state === 'ended' ? 'All days done' : 'Not started';
  return <View style={local.page}>
    <View style={styles.stack}>
      <BackLink to="Your lab" onPress={onBack} />
      <Copy style={local.status}>{status}</Copy>
      <Title small textRef={heading}>{experiment.question}</Title>
    </View>
    <BaselineContext timeline={timeline} />
    <TodayCard data={data} disabled={disabled} onCheckin={onCheckin} onOpenReport={onOpenReport} />
    <FinishCard experiment={experiment} timeline={timeline} token={token} offline={offline} onExpired={onExpired} onCompleted={onCompleted} />
    <Observations data={data} title="Your timeline" token={token} offline={offline} onExpired={onExpired} />
    <View style={local.change}>
      <Copy style={local.status}>The small change</Copy>
      <Copy accessibilityRole="header" style={styles.sectionTitle}>{experiment.intervention.action}</Copy>
      <Copy style={styles.muted}>When: {experiment.intervention.timing}</Copy>
      <Copy style={styles.muted}>How often: {experiment.intervention.frequency}</Copy>
      <Copy style={local.small}>{`Baseline days come first: keep your routine as it is. The change starts on day ${experiment.baseline_days + 1}.`}</Copy>
    </View>
    <Forecast prediction={experiment.prediction} metrics={experiment.metrics} />
  </View>;
}

const local = StyleSheet.create({
  page: { gap: SPACING.xl },
  status: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  change: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
});
