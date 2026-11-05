import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { type CheckinInput } from '@rhythm-health/contract';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { Action, Alert, Copy, Loading, useStyles, Notice } from './ui';
import { CheckinFlow, type CheckinStep } from './checkin-steps';
import { ApiError } from './lib/api';
import { listCheckins, metricAnswer, saveCheckin } from './lib/checkins';
import { getProgress } from './lib/experiments';
import type { DayData } from './today';
import { useColors } from './theme-core';

export { metricAnswer };

const answersKey = (values: Record<string, string | boolean>, intervention: boolean | undefined, note: string) => JSON.stringify({ values, intervention, note });

export function CheckinForm({ data: { experiment, timeline }, token, offline, onExpired, onSaved, onBack }: {
  data: DayData; token: string; offline: boolean; onExpired: () => void; onSaved: () => void; onBack: () => void;
}) { const COLORS = useColors(); const styles = useStyles();
  const day = timeline.progress.day_number;
  const test = timeline.days.find(item => item.day_number === day)?.phase === 'test';
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [intervention, setIntervention] = useState<boolean>();
  const [note, setNote] = useState('');
  const [loadedAnswers, setLoadedAnswers] = useState(() => answersKey({}, undefined, ''));
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
    if (Object.keys(errors).length) { setError('An answer is missing or needs checking. Check the answers below.'); return; }
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
  const caption = `Day ${day} · ${test ? 'Test' : 'Normal'} day`;
  const steps: CheckinStep[] = [
    ...(test ? [{ key: 'intervention_completed', kind: 'change' as const, action: experiment.intervention.action, caption, day }] : []),
    ...metrics.map(metric => ({ key: metric.key, kind: 'metric' as const, metric, caption, day })),
  ];
  const clearField = (key: string) => setFields(current => { if (!(key in current)) return current; const next = { ...current }; delete next[key]; return next; });
  return <View style={[styles.stack, { flexGrow: 1 }]}>
    {experiment.is_seeded && <Copy style={{ color: COLORS.moss }}>Sample check-in</Copy>}
    {offline && <Notice>You&apos;re offline; your answers are kept</Notice>}
    {!ready ? readError ? <><Alert>{readError}</Alert><Action label="Try again" disabled={offline} onPress={() => { setReadError(undefined); setAttempt(value => value + 1); }} /></>
      : offline ? <Copy>Reconnect to load your previous answers.</Copy> : <Loading message="Loading your answers…" />
      : <CheckinFlow steps={steps} values={{ ...values, intervention_completed: intervention }} fields={fields} note={note} onNote={setNote} busy={busy} offline={offline}
        onAnswer={(key, value) => { clearField(key); if (key === 'intervention_completed') setIntervention(value as boolean); else setValues(current => ({ ...current, [key]: value })); }}
        notice={already ? "Replaces today's answers." : undefined} alert={error && <Alert>{error}</Alert>}
        saveLabel={busy ? 'Saving…' : retrySave ? 'Try saving again' : already ? 'Update check-in' : 'Save check-in'} onSave={() => void save()} />}
  </View>;
}
