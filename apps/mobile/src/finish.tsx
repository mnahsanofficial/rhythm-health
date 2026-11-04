import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LAYOUT, RADII, SPACING } from '@rhythm-health/brand';
import type { Experiment, ExperimentTimeline, LabReport } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { completeExperiment, getReport, notEnoughCheckins } from './lib/reports';
import { Action, Alert, Copy, useStyles } from './ui';
import { themedStyles } from './theme-core';

type FinishProps = { experiment: Experiment; token: string; offline: boolean; onExpired: () => void; onCompleted: (report: LabReport) => void };

/** Nothing is left to record: the server says the days are over, or the last one is in. */
export function allDaysDone({ progress, days }: ExperimentTimeline) {
  if (progress.state === 'ended') return true;
  return progress.state === 'in_progress' && progress.days_remaining === 0 && days.some(day => day.day_number === progress.day_number && day.state === 'recorded');
}

/** A failure with an unknown outcome reads the saved report before anyone retries. */
function useFinish({ experiment, token, offline, onExpired, onCompleted }: FinishProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function finish() {
    if (inFlight.current || offline) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      onCompleted(await completeExperiment(token, experiment.id));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
      const short = notEnoughCheckins(cause);
      if (short) {
        setError(`Not enough check-ins yet: ${short.baseline_checkins} of ${short.baseline_required} baseline and ${short.intervention_checkins} of ${short.intervention_required} test days.`);
        return;
      }
      try {
        const saved = await getReport(token, experiment.id);
        if (saved) { onCompleted(saved); return; }
      } catch (read) {
        if (read instanceof ApiError && read.status === 401) { onExpired(); return; }
      }
      setError(cause instanceof Error ? cause.message : "Couldn't finish the experiment. Try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  return { busy, error, finish };
}

/** All days are done, so there's nothing to confirm: one tap finishes and opens the result. */
export function FinishNow({ disabled = false, ...props }: FinishProps & { disabled?: boolean }) { const styles = useStyles();
  const { busy, error, finish } = useFinish(props);
  return <>
    {error && <Alert>{error}</Alert>}
    <Action wide label={busy ? 'Getting your results…' : 'See your results'} disabled={disabled || busy || props.offline} onPress={() => void finish()} />
    <Copy style={styles.hint}>Finishing locks your answers.</Copy>
  </>;
}

/**
 * Finishing before the last day: offered once there is a recorded test day. It loses days, so it asks first.
 * The backend owns the minimum counts and explains a refusal.
 */
export function FinishCard({ timeline, ...props }: FinishProps & { timeline: ExperimentTimeline }) { const local = useLocal(); const styles = useStyles();
  const { experiment, offline } = props;
  const [confirming, setConfirming] = useState(false);
  const { busy, error, finish } = useFinish(props);
  const { progress } = timeline;
  const eligible = progress.state === 'in_progress' && timeline.days.some(day => day.phase === 'test' && day.state === 'recorded');
  if (experiment.is_seeded || !eligible || allDaysDone(timeline)) return null;
  const left = progress.days_remaining ?? 0;

  return <View style={local.card}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>You can finish early.</Copy>
    <Copy>{`You have enough days recorded to try.${left > 0 ? ` Finishing now skips ${left} test ${left === 1 ? 'day' : 'days'}, so there's less evidence to go on.` : ''}`}</Copy>
    {error && <Alert>{error}</Alert>}
    {!confirming ? <Action label="See results" secondary disabled={offline} onPress={() => setConfirming(true)} /> : <>
      <Copy>Finish this experiment now? You can&apos;t add check-ins after.</Copy>
      <Action label={busy ? 'Analysing…' : 'Yes, finish'} disabled={busy || offline} onPress={() => void finish()} />
      <Action label="Keep going" secondary disabled={busy} onPress={() => setConfirming(false)} />
    </>}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
}));
