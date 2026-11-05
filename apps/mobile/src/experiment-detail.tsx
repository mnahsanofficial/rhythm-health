import { StyleSheet, View } from 'react-native';
import { NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import type { LabReport } from '@rhythm-health/contract';
import { BaselineContext } from './baseline-context';
import { FinishCard } from './finish';
import { DetailsRow } from './details-sheet';
import { Forecast, ForecastReasons } from './forecast';
import { Observations } from './progress';
import { TodayCard } from './today-card';
import type { DayData } from './today';
import { useNavScreen } from './nav';
import { BackLink, Copy, useStyles, Title, useStepFocus } from './ui';
import { themedStyles } from './theme-core';

/** The experiment page: where it stands, finishing, every day, the plan and the forecast kept from the start. */
export function ExperimentDetail({ data, token, offline, disabled, onExpired, onBack, onCheckin, onOpenReport, onCompleted }: {
  data: DayData; token: string; offline: boolean; disabled: boolean; onExpired: () => void; onBack: () => void; onCheckin: () => void; onOpenReport: () => void; onCompleted: (report: LabReport) => void;
}) { const local = useLocal(); const styles = useStyles();
  useNavScreen({ kind: 'detail', onBack });
  const { experiment, timeline } = data;
  const { progress } = timeline;
  const heading = useStepFocus('experiment');
  const status = progress.state === 'in_progress'
    ? `Day ${progress.day_number} of ${progress.total_days} · ${progress.phase === 'intervention' ? 'Test' : 'Normal'}`
    : progress.state === 'completed' ? 'Completed' : progress.state === 'ended' ? 'All days done' : 'Not started';
  return <View style={local.page}>
    <View style={styles.stack}>
      <BackLink to="Today" onPress={onBack} />
      <Copy style={local.status}>{status}</Copy>
      <Title small textRef={heading}>{experiment.question}</Title>
    </View>
    <TodayCard data={data} disabled={disabled} token={token} offline={offline} onExpired={onExpired} onCompleted={onCompleted} onCheckin={onCheckin} onOpenReport={onOpenReport} />
    <FinishCard experiment={experiment} timeline={timeline} token={token} offline={offline} onExpired={onExpired} onCompleted={onCompleted} />
    <Observations data={data} title="Your timeline" token={token} offline={offline} onExpired={onExpired} />
    <View>
      <DetailsRow label="The change">
        <Copy style={NATIVE_TYPOGRAPHY.lead}>{experiment.intervention.action}</Copy>
        <Copy>When: {experiment.intervention.timing}</Copy>
        <Copy>How often: {experiment.intervention.frequency}</Copy>
        <Copy>{`Normal days come first: keep your routine as it is. The change starts on day ${experiment.baseline_days + 1}.`}</Copy>
      </DetailsRow>
      <DetailsRow label="Prediction">
        <Forecast prediction={experiment.prediction} metrics={experiment.metrics} />
        <ForecastReasons prediction={experiment.prediction} />
      </DetailsRow>
      {timeline.baseline_summary && progress.phase === 'intervention' && progress.state === 'in_progress' && <DetailsRow label="Your normal"><BaselineContext timeline={timeline} /></DetailsRow>}
    </View>
  </View>;
}

const useLocal = themedStyles((_COLORS, mode) => { const styles = useStyles.forMode(mode); return StyleSheet.create({
  page: { gap: SPACING.xl },
  status: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
}); });
