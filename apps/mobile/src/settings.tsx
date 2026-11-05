import { useState } from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import { LAYOUT, SPACING } from '@rhythm-health/brand';
import { devToolsOn } from './lib/config';
import { onlySamples } from './lib/reminders';
import { useReminders } from './reminder-context';
import { Action, Alert, Copy, useStyles, Title, Status } from './ui';
import { FormRow, FormRows } from './form-rows';
import { useColors } from './theme-core';
export function Settings() { const COLORS = useColors(); const styles = useStyles();
  const { service, state } = useReminders();
  const [error, setError] = useState(false);
  return <View style={styles.stack}>
    <Title>Daily reminders.</Title><Copy>When the next day opens. The lock screen never shows your question.</Copy>
    {Platform.OS === 'web' && <Copy>Reminders are available in the phone app.</Copy>}
    <FormRows><FormRow icon="bell" label="Daily reminders" trailing={<Switch style={{ minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction }} hitSlop={SPACING.sm} accessibilityLabel="Daily reminders" value={!onlySamples(state.data) && state.choice === 'on' && state.permission} disabled={onlySamples(state.data) || !state.ready || state.busy || Platform.OS === 'web'}
      trackColor={{ false: COLORS.line, true: COLORS.moss }} thumbColor={COLORS['on-accent']} onValueChange={value => void service.choose(value)} />} /></FormRows>
    {onlySamples(state.data) && <Copy>Reminders are off for this sample. Your reminder preference is kept for real experiments.</Copy>}
    {state.choice === 'on' && !state.permission && <><Copy>Reminders are off. Allow notifications for Expo Go in your phone Settings.</Copy>
      <Action label="Open phone Settings" secondary onPress={() => { void Linking.openSettings().catch(() => setError(true)); }} /></>}
    {state.choice === 'off' && <Copy>Reminders are off.</Copy>}
    {error && <Alert>Couldn&apos;t open Settings. Open your phone Settings and choose Notifications → Expo Go.</Alert>}
    {devToolsOn() && <Action label="Send test reminder" secondary disabled={onlySamples(state.data) || state.busy || !state.permission || state.choice !== 'on' || !state.data?.some(item => !item.experiment.is_seeded && item.timeline.progress.state === 'in_progress')} onPress={() => void service.test()} />}
    {state.notice && <Status>{state.notice}</Status>}
  </View>;
}
export function ReminderNotice({ feedbackOnly = false }: { feedbackOnly?: boolean }) { const styles = useStyles();
  const { service, state } = useReminders();
  return <>
    {state.error && <><Alert>{state.error}</Alert><Action label="Try again" secondary disabled={state.busy} onPress={() => void service.retry()} /></>}
    {!feedbackOnly && !onlySamples(state.data) && state.ready && state.choice === null && state.data?.some(item => !item.experiment.is_seeded && item.timeline.recorded_days > 0) && Platform.OS !== 'web' && <View style={styles.decision}>
      <Copy>A reminder when the next day opens?</Copy>
      <Action label="Enable daily reminders" disabled={state.busy} onPress={() => void service.choose(true)} />
      <Action label="Not now" secondary disabled={state.busy} onPress={() => void service.choose(false)} />
    </View>}
    {!feedbackOnly && !onlySamples(state.data) && state.choice === 'on' && !state.permission && <Copy>Reminders are off. Open Settings to allow notifications.</Copy>}
  </>;
}
