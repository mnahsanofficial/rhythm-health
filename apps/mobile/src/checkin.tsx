import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { COLORS, LAYOUT, SPACING } from '@rhythm-health/brand';
import { MAX_DURATION_MINUTES, MAX_NOTE_LENGTH, MAX_NUMBER, type CheckinInput } from '@rhythm-health/contract';
import { Action, Alert, Copy, Loading, styles, Title } from './ui';
import { MetricInput, Radio } from './metric-input';
import { ApiError } from './lib/api';
import { listCheckins, saveCheckin } from './lib/checkins';
import { getProgress } from './lib/experiments';
import type { DayData } from './today';

export function CheckinForm({ data: { experiment, timeline }, token, offline, onExpired, onSaved, onBack }: {
  data: DayData; token: string; offline: boolean; onExpired: () => void; onSaved: () => void; onBack: () => void;
}) {
  const day = timeline.progress.day_number;
  const test = timeline.days.find(item => item.day_number === day)?.phase === 'test';
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [intervention, setIntervention] = useState<boolean>();
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const [readError, setReadError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [retrySave, setRetrySave] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    if (offline || ready) return;
    let active = true;
    listCheckins(token, experiment.id).then(checkins => {
      if (!active) return;
      const previous = checkins.find(item => item.day_number === day);
      if (previous) {
        setValues(Object.fromEntries(Object.entries(previous.metric_values).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)])));
        setIntervention(previous.intervention_completed); setNote(previous.note ?? '');
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
      const raw = values[metric.key];
      if (metric.type === 'boolean') {
        if (typeof raw !== 'boolean') errors[metric.key] = 'Choose Yes or No.';
        else metric_values[metric.key] = raw;
        continue;
      }
      const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
      const number = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
      if (!Number.isFinite(number)) errors[metric.key] = 'Enter an answer as a number.';
      else if (metric.type === 'scale' && (!Number.isInteger(number) || number < (metric.min ?? 1) || number > (metric.max ?? 10))) errors[metric.key] = `Choose a whole number from ${metric.min ?? 1} to ${metric.max ?? 10}.`;
      else if (metric.type === 'duration' && (number < 0 || number > MAX_DURATION_MINUTES)) errors[metric.key] = `Enter minutes from 0 to ${MAX_DURATION_MINUTES}.`;
      else if (Math.abs(number) > MAX_NUMBER) errors[metric.key] = `Enter a number between -${MAX_NUMBER} and ${MAX_NUMBER}.`;
      else metric_values[metric.key] = number;
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
  return <View style={styles.stack}>
    <Action label="Back to Today" secondary disabled={busy} onPress={onBack} />
    <Copy style={styles.number}>Day {day} · {test ? 'Test' : 'Baseline'}</Copy>
    {experiment.is_seeded && <Copy style={styles.sectionTitle}>Sample experiment · Sample check-in</Copy>}
    <Title>Today&apos;s check-in.</Title>
    <Copy style={styles.muted}>A small record of how today felt. Only today can be recorded.</Copy>
    {offline && <Copy accessibilityLiveRegion="polite">You&apos;re offline; your answers are kept</Copy>}
    {!ready ? readError ? <><Alert>{readError}</Alert><Action label="Try again" disabled={offline} onPress={() => { setReadError(undefined); setAttempt(value => value + 1); }} /></>
      : offline ? <Copy>Reconnect to load your previous answers.</Copy> : <Loading message="Loading your answers…" />
      : <>
        {error && <Alert>{error}</Alert>}
        {test && <View style={styles.divider}>
          <Copy>Did you make the change today?</Copy><Copy style={styles.muted}>{experiment.intervention.action}</Copy>
          <Radio label="Yes, I made the change" selected={intervention === true} onPress={() => setIntervention(true)} disabled={busy} />
          <Radio label="Not today" selected={intervention === false} onPress={() => setIntervention(false)} disabled={busy} />
          {fields.intervention_completed && <Copy style={{ color: COLORS.clay }}>{fields.intervention_completed}</Copy>}
        </View>}
        {experiment.metrics.map(metric => <View key={metric.key} style={styles.divider}>
          <MetricInput metric={metric} value={values[metric.key]} onChange={value => setValues(current => ({ ...current, [metric.key]: value }))} disabled={busy} error={fields[metric.key]} />
        </View>)}
        <View style={styles.divider}>
          <Copy>Optional note</Copy>
          <TextInput accessibilityLabel="Optional note" multiline value={note} onChangeText={setNote} maxLength={MAX_NOTE_LENGTH} editable={!busy}
            onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)}
            style={[styles.input, noteFocused && styles.focus, { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' }]} />
          <Copy style={styles.muted}>{note.length}/{MAX_NOTE_LENGTH}</Copy>
          {fields.note && <Copy style={{ color: COLORS.clay }}>{fields.note}</Copy>}
        </View>
        <View style={{ paddingTop: SPACING.md }}><Action label={busy ? 'Saving…' : retrySave ? 'Try saving again' : "Save today's check-in"}
          disabled={busy || offline} onPress={() => void save()} /></View>
      </>}
  </View>;
}
