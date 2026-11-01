import { useState } from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import { COLORS, LAYOUT, SPACING } from '@rhythm-health/brand';
import { useReminders } from './reminder-context';
import { Action, Alert, Copy, styles, Title } from './ui';
export function Settings({ email, signOut }: { email?: string; signOut: () => void }) {
  const { service, state } = useReminders();
  const [error, setError] = useState(false);
  return <View style={styles.stack}>
    <Title>Settings.</Title><Copy style={styles.muted}>A reminder when the next day opens, not another thing to remember.</Copy>
    {Platform.OS === 'web' && <Copy>Reminders are available in the phone app.</Copy>}
    <View style={styles.divider}><Copy>Daily reminders</Copy>
      <Switch style={{ minHeight: LAYOUT.primaryAction, minWidth: LAYOUT.primaryAction }} hitSlop={SPACING.sm} accessibilityLabel="Daily reminders" value={!state.data?.experiment.is_seeded && state.choice === 'on' && state.permission} disabled={state.data?.experiment.is_seeded || !state.ready || state.busy || Platform.OS === 'web'}
        trackColor={{ false: COLORS.line, true: COLORS.moss }} thumbColor={COLORS.paper} onValueChange={value => void service.choose(value)} />
      {state.data?.experiment.is_seeded && <Copy>Reminders are off for this sample. Your reminder preference is kept for real experiments.</Copy>}
      <Copy style={styles.muted}>At the next opening returned by your experiment. The lock screen shows the day, never your habit question.</Copy>
    </View>
    {state.choice === 'on' && !state.permission && <><Copy>Reminders are off. Allow notifications for Expo Go in your phone Settings.</Copy>
      <Action label="Open phone Settings" secondary onPress={() => { void Linking.openSettings().catch(() => setError(true)); }} /></>}
    {state.choice === 'off' && <Copy>Reminders are off.</Copy>}
    {error && <Alert>Couldn&apos;t open Settings. Open your phone Settings and choose Notifications → Expo Go.</Alert>}
    {__DEV__ && <Action label="Send a test reminder in 10 seconds" secondary disabled={state.data?.experiment.is_seeded || state.busy || !state.permission || state.choice !== 'on' || state.data?.timeline.progress.state !== 'in_progress'} onPress={() => void service.test()} />}
    {state.notice && <Copy accessibilityLiveRegion="polite">{state.notice}</Copy>}
    <View style={styles.divider}><Copy>{email}</Copy><Action label="Sign out" secondary onPress={signOut} /></View>
  </View>;
}
export function ReminderNotice({ feedbackOnly = false }: { feedbackOnly?: boolean }) {
  const { service, state } = useReminders();
  return <>
    {state.error && <><Alert>{state.error}</Alert><Action label="Retry reminder" secondary disabled={state.busy} onPress={() => void service.retry()} /></>}
    {!feedbackOnly && !state.data?.experiment.is_seeded && state.ready && state.choice === null && (state.data?.timeline.recorded_days ?? 0) > 0 && Platform.OS !== 'web' && <View style={styles.decision}>
      <Copy>A reminder when the next day opens can help you keep a small daily record. It shows only the day on your lock screen.</Copy>
      <Action label="Enable daily reminders" disabled={state.busy} onPress={() => void service.choose(true)} />
      <Action label="Not now" secondary disabled={state.busy} onPress={() => void service.choose(false)} />
    </View>}
    {!feedbackOnly && !state.data?.experiment.is_seeded && state.choice === 'on' && !state.permission && <Copy>Reminders are off. Open Settings to allow notifications.</Copy>}
  </>;
}
