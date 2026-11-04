import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_NOTE_LENGTH, type TodayCheckin, type TodayCheckinInput } from '@rhythm-health/contract';
import { metricAnswer } from './checkin';
import { MetricInput, Radio } from './metric-input';
import { ApiError, detailCode } from './lib/api';
import { getTodayCheckin, saveTodayCheckin } from './lib/checkins';
import { Action, Alert, BackLink, Copy, useStyles, Title, useStepFocus, Notice } from './ui';
import { useColors, themedStyles } from './theme-core';

const prefilled = (today: TodayCheckin) => Object.fromEntries(today.questions.filter(question => question.value !== null && question.value !== undefined)
  .map(question => [question.id, typeof question.value === 'boolean' ? question.value : String(question.value)]));
const madeChanges = (today: TodayCheckin) => Object.fromEntries(today.experiments.filter(item => item.change_required && typeof item.change_made === 'boolean')
  .map(item => [item.id, item.change_made as boolean]));

/** One check-in for every experiment due today. The backend decides what combines and saves it all or not at all. */
export function CombinedCheckin({ initial, token, offline, onExpired, onBack }: {
  initial: TodayCheckin; token: string; offline: boolean; onExpired: () => void; onBack: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const [today, setToday] = useState(initial);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => prefilled(initial));
  const [changes, setChanges] = useState<Record<string, boolean>>(() => madeChanges(initial));
  const [note, setNote] = useState(initial.note ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const heading = useStepFocus(saved ? 'saved' : 'form');
  const testing = today.experiments.filter(item => item.change_required);
  const recorded = today.experiments.some(item => item.recorded);

  const failed = (cause: unknown, fallback: string) => {
    if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
    if (cause instanceof ApiError) setFields(cause.fields);
    setError(cause instanceof Error ? cause.message : fallback);
  };
  async function reload() {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const fresh = await getTodayCheckin(token);
      if (!fresh.experiments.length) { onBack(); return; }
      setToday(fresh); setValues(prefilled(fresh)); setChanges(madeChanges(fresh)); setNote(fresh.note ?? ''); setFields({}); setError(undefined); setStale(false);
    } catch (cause) { failed(cause, "Couldn't load today's check-in. Try again."); }
    finally { saving.current = false; setBusy(false); }
  }
  async function save() {
    if (offline || saving.current) return;
    const errors: Record<string, string> = {};
    const answers: TodayCheckinInput['answers'] = {};
    for (const question of today.questions) {
      const result = metricAnswer(question.metric, values[question.id]);
      if ('error' in result) errors[question.id] = result.error;
      else answers[question.id] = result.value;
    }
    for (const item of testing) if (changes[item.id] === undefined) errors[`change:${item.id}`] = 'Choose whether you made the change.';
    setFields(errors); setStale(false);
    if (Object.keys(errors).length) { setError('An answer is missing or needs checking. Review the fields below.'); return; }
    saving.current = true; setBusy(true); setError(undefined);
    try {
      const result = await saveTodayCheckin(token, { revision: today.revision, answers, changes, note: note.trim() || null });
      setToday(result); setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && detailCode(cause) === 'checkin_changed') setStale(true);
      failed(cause, "Couldn't save your check-in. Try again.");
    } finally { saving.current = false; setBusy(false); }
  }

  if (saved) return <View style={styles.stack}>
    <Title textRef={heading}>Today&apos;s check-ins are recorded.</Title>
    {today.experiments.map(item => <View key={item.id} style={local.item}>
      <Copy style={local.day}>{`Day ${item.day_number} of ${item.total_days}`}</Copy>
      <Copy>{item.question}</Copy>
    </View>)}
    <Action label="Back to your lab" onPress={onBack} />
    <Action label="Edit answers" secondary onPress={() => setSaved(false)} />
  </View>;

  return <View style={styles.stack}>
    <BackLink to="Your lab" disabled={busy} onPress={onBack} />
    <Title textRef={heading}>Today&apos;s check-in.</Title>
    <Copy style={[styles.muted, NATIVE_TYPOGRAPHY.lead]}>{`One check-in for your ${today.experiments.length} experiments. Shared questions are asked once.`}</Copy>
    {offline && <Notice>You&apos;re offline; your answers are kept</Notice>}
    {recorded && <Copy style={local.notice}>You&apos;ve already checked in for some of these today. Saving again replaces those answers.</Copy>}
    {error && <Alert>{error}</Alert>}
    {stale && <Action label="Reload today's check-in" secondary disabled={busy || offline} onPress={() => void reload()} />}
    {testing.map(item => <View key={item.id} style={styles.stack}>
      <Copy accessibilityRole="header" style={NATIVE_TYPOGRAPHY.lead}>Did you make the change today?</Copy>
      <View style={local.notice}>
        <Copy>{item.action}</Copy>
        <Copy style={local.small}>When: {item.timing}</Copy>
      </View>
      <View style={local.pair}>
        <View style={local.half}><Radio label="Yes, I made the change" text="Yes" selected={changes[item.id] === true} onPress={() => setChanges(current => ({ ...current, [item.id]: true }))} disabled={busy} /></View>
        <View style={local.half}><Radio label="Not today" selected={changes[item.id] === false} onPress={() => setChanges(current => ({ ...current, [item.id]: false }))} disabled={busy} /></View>
      </View>
      {fields[`change:${item.id}`] && <Copy style={{ color: COLORS.clay }}>{fields[`change:${item.id}`]}</Copy>}
    </View>)}
    {today.questions.map(question => <View key={question.id} style={styles.divider}>
      <Copy style={local.audience}>{question.experiment_ids.length === 1
        ? `For: ${today.experiments.find(item => item.id === question.experiment_ids[0])?.question ?? ''}`
        : question.experiment_ids.length === 2 ? 'For both experiments' : `For all ${question.experiment_ids.length} experiments`}</Copy>
      <MetricInput metric={question.metric} value={values[question.id]} onChange={value => setValues(current => ({ ...current, [question.id]: value }))} disabled={busy} error={fields[question.id]} />
    </View>)}
    <View style={styles.divider}>
      <Copy style={NATIVE_TYPOGRAPHY.lead}>Anything unusual yesterday? (optional)</Copy>
      <Copy style={local.small}>Saved with every experiment here.</Copy>
      <TextInput accessibilityLabel="Optional note" multiline value={note} onChangeText={setNote} maxLength={MAX_NOTE_LENGTH} editable={!busy}
        placeholder="Late night, a stressful day, a long run…" placeholderTextColor={COLORS.muted}
        style={[styles.input, { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' }]} />
      {fields.note && <Copy style={{ color: COLORS.clay }}>{fields.note}</Copy>}
    </View>
    <Action label={busy ? 'Saving…' : recorded ? "Update check-in" : "Save check-in"} disabled={busy || offline} onPress={() => void save()} />
  </View>;
}

const useLocal = themedStyles((COLORS, mode) => { const styles = useStyles.forMode(mode); return StyleSheet.create({
  notice: { padding: SPACING.sm + SPACING.xs, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'] },
  item: { gap: SPACING.xs },
  day: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  audience: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.moss },
  pair: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1 },
}); });
