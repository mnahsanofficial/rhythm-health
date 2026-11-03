import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, LAYOUT, RADII, SPACING } from '@rhythm-health/brand';
import type { Experiment, ExperimentTimeline, LabReport } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { completeExperiment, getReport, notEnoughCheckins } from './lib/reports';
import { Action, Alert, Copy, styles } from './ui';

/**
 * Offered once there is a recorded test day; the backend owns the minimum counts and explains a
 * refusal. A failure with an unknown outcome reads the saved report before anyone retries.
 */
export function FinishCard({ experiment, timeline, token, offline, onExpired, onCompleted }: {
  experiment: Experiment; timeline: ExperimentTimeline; token: string; offline: boolean; onExpired: () => void; onCompleted: (report: LabReport) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const { progress } = timeline;
  const early = progress.state === 'in_progress';
  const eligible = progress.state === 'ended' || (early && timeline.days.some(day => day.phase === 'test' && day.state === 'recorded'));
  if (experiment.is_seeded || !eligible) return null;
  const left = early ? progress.days_remaining ?? 0 : 0;

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
      setError(cause instanceof Error ? cause.message : "Couldn't finish the experiment.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <View style={local.card}>
    <Copy accessibilityRole="header" style={styles.sectionTitle}>{early ? 'You can finish early.' : 'Ready for your results.'}</Copy>
    <Copy>{early
      ? `You have enough days recorded to try.${left > 0 ? ` Finishing now skips ${left} test ${left === 1 ? 'day' : 'days'}, so there's less evidence to go on.` : ''}`
      : 'Finishing runs the analysis and compares it with the prediction.'}</Copy>
    {error && <Alert>{error}</Alert>}
    {!confirming ? <Action label="Finish and see results" secondary={early} disabled={offline} onPress={() => setConfirming(true)} /> : <>
      <Copy>Finish this experiment now? You can&apos;t add check-ins after.</Copy>
      <Action label={busy ? 'Analysing…' : 'Yes, finish'} disabled={busy || offline} onPress={() => void finish()} />
      <Action label="Keep going" secondary disabled={busy} onPress={() => setConfirming(false)} />
    </>}
  </View>;
}

const local = StyleSheet.create({
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
});
