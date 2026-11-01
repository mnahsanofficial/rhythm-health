import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { Experiment } from '@rhythm-health/contract';
import { Action, Alert, Copy, styles } from './ui';
import { ApiError, apiPost } from './lib/api';

export function SampleControls({ experiment, token, disabled, onChanged, onExpired }: {
  experiment?: Experiment; token: string; disabled: boolean; onChanged: () => Promise<void>; onExpired: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  async function act() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      if (experiment) await apiPost(token, `/api/demo/active/${encodeURIComponent(experiment.id)}/remove`, { confirmed: true }, "Couldn't remove the sample. Try again.");
      else await apiPost(token, '/api/demo/active', {}, "Couldn't start the sample. Try again.");
      setConfirm(false); await onChanged();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally { pending.current = false; setBusy(false); }
  }
  if (experiment && !experiment.is_seeded) return <Copy style={styles.muted}>A sample needs the active experiment slot. Finish your active experiment before trying a sample.</Copy>;
  return <View style={styles.divider}>
    <Copy style={styles.sectionTitle}>{experiment ? 'Sample experiment' : 'Try the daily loop'}</Copy>
    <Copy style={styles.muted}>Sample answers never become your real experiment data. No AI calls. Reminders are off for this sample.</Copy>
    {experiment && <Copy style={styles.muted}>Remove this sample to free the slot for a real experiment.</Copy>}
    {error && <Alert>{error}</Alert>}
    {confirm ? <View style={styles.stack}>
      <Copy accessibilityRole="header">Remove this sample experiment?</Copy>
      <Copy>Only this sample and its check-ins will be deleted. Your real experiments stay saved.</Copy>
      <Action label={busy ? 'Removing sample…' : 'Confirm remove sample'} disabled={disabled || busy} onPress={() => void act()} />
      <Action label="Keep sample" secondary disabled={busy} onPress={() => setConfirm(false)} />
    </View> : <Action label={busy ? 'Starting sample…' : experiment ? 'Remove sample' : 'Try a sample experiment'} secondary disabled={disabled || busy}
      onPress={() => experiment ? setConfirm(true) : void act()} />}
  </View>;
}
