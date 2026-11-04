import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import type { LabReport, OutcomeChoice } from '@rhythm-health/contract';
import { FormRow, FormRows } from './form-rows';
import { ApiError } from './lib/api';
import { saveOutcome } from './lib/progress-summary';
import { reportPercent, SIGNAL_COPY } from './lib/reports';
import { useNavScreen } from './nav';
import { Alert, Copy, ForwardLink, Title, useStepFocus, useStyles } from './ui';
import { themedStyles } from './theme-core';

/**
 * When an experiment ends: the result, then a choice. Everything shown comes from the saved report, and no paid call happens
 * here. "Write my report" stays in the Lab Report. Keeping a habit must be stored; the other two only say where to go next,
 * so a failed save doesn't hold them up.
 */
export function FinishFlow({ report, token, offline, onExpired, onSeeReport, onKeep, onVariation, onNew }: {
  report: LabReport; token: string; offline: boolean; onExpired: () => void; onSeeReport: () => void; onKeep: () => void; onVariation: (question: string) => void; onNew: () => void;
}) { const local = useLocal(); const ui = useStyles();
  useNavScreen({ kind: 'flow', onBack: onSeeReport });
  const heading = useStepFocus('finish');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const { experiment, analysis } = report;
  const primary = analysis.metrics.find(metric => metric.key === analysis.primary_metric);
  const guess = analysis.personal_guess;
  const { expected_change_min: min, expected_change_max: max } = experiment.prediction;
  async function choose(choice: OutcomeChoice) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(null);
    try {
      await saveOutcome(token, experiment.id, choice);
      if (choice === 'keep') onKeep();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
      if (choice === 'keep') { setError("Couldn't save your choice. Try again."); return; }
    } finally { sending.current = false; setBusy(false); }
    if (choice === 'variation') onVariation(experiment.question);
    if (choice === 'new') onNew();
  }
  return <View style={ui.stack}>
    <Title textRef={heading}>{`All ${experiment.baseline_days + experiment.intervention_days} days are done.`}</Title>
    <Copy style={NATIVE_TYPOGRAPHY.lead}>{SIGNAL_COPY[analysis.signal.classification].summary}</Copy>
    <FormRows>
      <FormRow label="Your guess" value={guess ? reportPercent(guess.guessed_change_percent, 2) : 'No guess'} />
      <FormRow label="We predicted" value={`${reportPercent(min)} to ${reportPercent(max)}`} />
      <FormRow label="What happened" value={primary?.percent_change === null || primary?.percent_change === undefined ? 'Not enough data' : reportPercent(primary.percent_change)} />
    </FormRows>
    {analysis.overlaps.map(overlap => <Copy key={overlap.experiment_id}>{overlap.description}</Copy>)}
    <Copy style={local.caption}>A short personal experiment shows a pattern, not proof.</Copy>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>What next?</Copy>
    {error && <Alert>{error}</Alert>}
    <FormRows>
      <FormRow icon="goals" label="Keep this habit" hint="Adds it to Habits I kept on Progress" disabled={busy || offline} onPress={() => void choose('keep')} />
      <FormRow icon="habits" label="Try a variation" hint="Opens Ask with this question to edit" disabled={busy || offline} onPress={() => void choose('variation')} />
      <FormRow icon="ask" label="Test something new" hint="Opens Ask" disabled={busy || offline} onPress={() => void choose('new')} />
    </FormRows>
    <ForwardLink label="See full Lab Report" onPress={onSeeReport} />
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, paddingTop: SPACING.xs },
}));
