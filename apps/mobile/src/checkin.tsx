import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_DURATION_MINUTES, MAX_NOTE_LENGTH, MAX_NUMBER, type CheckinInput, type Metric } from '@rhythm-health/contract';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { Action, Alert, Copy, Loading, StickyAction, useStyles, Title, Status, Notice } from './ui';
import { MetricInput, Radio } from './metric-input';
import { ApiError } from './lib/api';
import { listCheckins, saveCheckin } from './lib/checkins';
import { getProgress } from './lib/experiments';
import type { DayData } from './today';
import { useColors, themedStyles } from './theme-core';

/** Helps the person fix an answer before sending. The backend's validation is the real check. */
export function metricAnswer(metric: Metric, raw: string | boolean | undefined): { value: boolean | number } | { error: string } {
  if (metric.type === 'boolean') return typeof raw === 'boolean' ? { value: raw } : { error: 'Choose Yes or No.' };
  const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
  const number = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
  if (!Number.isFinite(number)) return { error: 'Enter an answer as a number.' };
  if (metric.type === 'scale' && (!Number.isInteger(number) || number < (metric.min ?? 1) || number > (metric.max ?? 10))) return { error: `Choose a whole number from ${metric.min ?? 1} to ${metric.max ?? 10}.` };
  if (metric.type === 'duration' && (number < 0 || number > MAX_DURATION_MINUTES)) return { error: `Enter minutes from 0 to ${MAX_DURATION_MINUTES}.` };
  if (Math.abs(number) > MAX_NUMBER) return { error: `Enter a number between -${MAX_NUMBER} and ${MAX_NUMBER}.` };
  return { value: number };
}

const answersKey = (values: Record<string, string | boolean>, intervention: boolean | undefined, note: string) => JSON.stringify({ values, intervention, note });

export function CheckinForm({ data: { experiment, timeline }, token, offline, onExpired, onSaved, onBack }: {
  data: DayData; token: string; offline: boolean; onExpired: () => void; onSaved: () => void; onBack: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const day = timeline.progress.day_number;
  const test = timeline.days.find(item => item.day_number === day)?.phase === 'test';
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [intervention, setIntervention] = useState<boolean>();
  const [note, setNote] = useState('');
  const [loadedAnswers, setLoadedAnswers] = useState(() => answersKey({}, undefined, ''));
  const [noteFocused, setNoteFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const [already, setAlready] = useState(false);
  const [readError, setReadError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [retrySave, setRetrySave] = useState(false);
  const [busy, setBusy] = useState(false);
  useNavScreen({ kind: 'flow', onBack, busy, unsaved: answersKey(values, intervention, note) !== loadedAnswers ? WONT_BE_KEPT.answers : null });
  const saving = useRef(false);
  useEffect(() => {
    if (offline || ready) return;
    let active = true;
    listCheckins(token, experiment.id).then(checkins => {
      if (!active) return;
      const previous = checkins.find(item => item.day_number === day);
      if (previous) {
        setAlready(true);
        const restored = Object.fromEntries(Object.entries(previous.metric_values).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)]));
        setValues(restored);
        setIntervention(previous.intervention_completed); setNote(previous.note ?? '');
        setLoadedAnswers(answersKey(restored, previous.intervention_completed, previous.note ?? ''));
      }
      setReadError(undefined); setReady(true);
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setReadError(cause instanceof Error ? cause.message : "Couldn't load your answers.");
    });
    return () => { active = false; };
  }, [token, experiment.id, day, offline, ready, attempt, onExpired]);

  async function save() {
    if (offline || saving.current) return;
    const errors: Record<string, string> = {};
    const metric_values: CheckinInput['metric_values'] = {};
    for (const metric of experiment.metrics) {
      const result = metricAnswer(metric, values[metric.key]);
      if ('error' in result) errors[metric.key] = result.error;
      else metric_values[metric.key] = result.value;
    }
    if (test && intervention === undefined) errors.intervention_completed = 'Choose whether you made the change.';
    setFields(errors); setRetrySave(false);
    if (Object.keys(errors).length) { setError('An answer is missing or needs checking. Review the fields below.'); return; }
    saving.current = true; setBusy(true); setError(undefined);
    try {
      const fresh = await getProgress(token, experiment.id);
      if (fresh.progress.state !== 'in_progress' || fresh.progress.day_number !== day) {
        setError('Today has changed. Go back to Today to load the current day before saving.'); return;
      }
      await saveCheckin(token, experiment.id, { metric_values, ...(test ? { intervention_completed: intervention } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else { setRetrySave(true); setError(cause instanceof Error ? cause.message : "Couldn't save your check-in. Try again."); if (cause instanceof ApiError) setFields(cause.fields); }
    } finally { saving.current = false; setBusy(false); }
  }
  const metrics = [...experiment.metrics].sort((a, b) => Number(b.primary) - Number(a.primary));
  const total = metrics.length + Number(test);
  const answered = metrics.filter(metric => values[metric.key] !== undefined && values[metric.key] !== '').length + Number(test && intervention !== undefined);
  return <View style={styles.stack}>
    <Copy style={local.phase}>{`Day ${day} of ${timeline.progress.total_days} · ${test ? 'Test' : 'Baseline'} day ${timeline.progress.phase_day} of ${timeline.progress.phase_days}`}</Copy>
    {experiment.is_seeded && <Copy style={{ color: COLORS.moss }}>Sample experiment · Sample check-in</Copy>}
    <Title>Today&apos;s check-in.</Title>
    <Copy>{test ? 'Test day: tell us how it went.' : 'Normal day: change nothing, just notice.'}</Copy>
    {offline && <Notice>You&apos;re offline; your answers are kept</Notice>}
    {!ready ? readError ? <><Alert>{readError}</Alert><Action label="Try again" disabled={offline} onPress={() => { setReadError(undefined); setAttempt(value => value + 1); }} /></>
      : offline ? <Copy>Reconnect to load your previous answers.</Copy> : <Loading message="Loading your answers…" />
      : <>
        <View style={local.meter}>
          <View style={local.meterRow}>
            <Status style={local.count}>{`${answered} of ${total} answered`}</Status>
          </View>
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Check-in answers" accessibilityValue={{ min: 0, max: total, now: answered }} style={local.track}>
            <View style={[local.fill, { width: `${total ? (answered / total) * 100 : 0}%` }]} />
          </View>
        </View>
        {already && <Copy style={local.notice}>You&apos;ve already checked in today. Saving again replaces those answers.</Copy>}
        {error && <Alert>{error}</Alert>}
        {test && <View style={styles.stack}>
          <Copy accessibilityRole="header" style={NATIVE_TYPOGRAPHY.lead}>Did you make the change today?</Copy>
          <View style={local.change}>
            <Copy>{experiment.intervention.action}</Copy>
            <Copy style={local.small}>When: {experiment.intervention.timing}</Copy>
          </View>
          <View style={local.pair}>
            <View style={local.half}><Radio label="Yes, I made the change" text="Yes" selected={intervention === true} onPress={() => setIntervention(true)} disabled={busy} /></View>
            <View style={local.half}><Radio label="Not today" selected={intervention === false} onPress={() => setIntervention(false)} disabled={busy} /></View>
          </View>
          {fields.intervention_completed && <Copy style={{ color: COLORS.clay }}>{fields.intervention_completed}</Copy>}
        </View>}
        {metrics.map(metric => <View key={metric.key} style={styles.divider}>
          <MetricInput metric={metric} value={values[metric.key]} onChange={value => setValues(current => ({ ...current, [metric.key]: value }))} disabled={busy} error={fields[metric.key]} />
        </View>)}
        <View style={styles.divider}>
          <Copy style={NATIVE_TYPOGRAPHY.lead}>Anything unusual? (optional)</Copy>
          <TextInput accessibilityLabel="Optional note" multiline value={note} onChangeText={setNote} maxLength={MAX_NOTE_LENGTH} editable={!busy}
            placeholder="Late night, a stressful day, a long run…" placeholderTextColor={COLORS.muted}
            onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)}
            style={[styles.input, noteFocused && styles.focus, { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' }]} />
          {fields.note && <Copy style={{ color: COLORS.clay }}>{fields.note}</Copy>}
        </View>
        <StickyAction><Action wide label={busy ? 'Saving…' : retrySave ? 'Try saving again' : already ? "Update check-in" : "Save check-in"}
          disabled={busy || offline} onPress={() => void save()} /></StickyAction>
      </>}
  </View>;
}

const useLocal = themedStyles((COLORS, mode) => { const styles = useStyles.forMode(mode); return StyleSheet.create({
  phase: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
  meter: { gap: SPACING.sm, paddingVertical: SPACING.md, borderTopWidth: LAYOUT.focusWidth / 2, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  meterRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm },
  count: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.ink },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  track: { height: SPACING.xs, overflow: 'hidden', borderRadius: RADII.pill, backgroundColor: COLORS.line },
  fill: { height: '100%', backgroundColor: COLORS.moss },
  notice: { padding: SPACING.sm + SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'] },
  change: { padding: SPACING.sm + SPACING.xs, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'] },
  pair: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1 },
}); });
