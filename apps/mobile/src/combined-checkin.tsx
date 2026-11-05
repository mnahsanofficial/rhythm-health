import { useRef, useState } from 'react';
import { View } from 'react-native';
import { type TodayCheckin, type TodayCheckinInput } from '@rhythm-health/contract';
import { CheckinFlow, type CheckinStep } from './checkin-steps';
import { ApiError, detailCode } from './lib/api';
import { getTodayCheckin, metricAnswer, saveTodayCheckin } from './lib/checkins';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { Action, Alert, useStyles, Notice } from './ui';

const prefilled = (today: TodayCheckin) => Object.fromEntries(today.questions.filter(question => question.value !== null && question.value !== undefined)
  .map(question => [question.id, typeof question.value === 'boolean' ? question.value : String(question.value)]));
const madeChanges = (today: TodayCheckin) => Object.fromEntries(today.experiments.filter(item => item.change_required && typeof item.change_made === 'boolean')
  .map(item => [item.id, item.change_made as boolean]));

/** One check-in for every experiment due today. The backend decides what combines and saves it all or not at all. */
export function CombinedCheckin({ initial, token, offline, onExpired, onBack, onSaved }: {
  initial: TodayCheckin; token: string; offline: boolean; onExpired: () => void; onBack: () => void; onSaved: (result: TodayCheckin) => void;
}) { const styles = useStyles();
  const [today, setToday] = useState(initial);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => prefilled(initial));
  const [changes, setChanges] = useState<Record<string, boolean>>(() => madeChanges(initial));
  const [note, setNote] = useState(initial.note ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const answersKey = JSON.stringify({ values, changes, note });
  const [loadedAnswers, setLoadedAnswers] = useState(answersKey);
  useNavScreen({ kind: 'flow', onBack, busy, unsaved: answersKey !== loadedAnswers ? WONT_BE_KEPT.answers : null });
  const saving = useRef(false);
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
      setToday(fresh); setValues(prefilled(fresh)); setChanges(madeChanges(fresh)); setNote(fresh.note ?? ''); setLoadedAnswers(JSON.stringify({ values: prefilled(fresh), changes: madeChanges(fresh), note: fresh.note ?? '' })); setFields({}); setError(undefined); setStale(false);
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
    if (Object.keys(errors).length) { setError('An answer is missing or needs checking. Check the answers below.'); return; }
    saving.current = true; setBusy(true); setError(undefined);
    try {
      const result = await saveTodayCheckin(token, { revision: today.revision, answers, changes, note: note.trim() || null });
      onSaved(result);
    } catch (cause) {
      if (cause instanceof ApiError && detailCode(cause) === 'checkin_changed') setStale(true);
      failed(cause, "Couldn't save your check-in. Try again.");
    } finally { saving.current = false; setBusy(false); }
  }

  const steps: CheckinStep[] = [];
  const asked = new Set<string>();
  for (const item of today.experiments) {
    const caption = `Day ${item.day_number} · ${item.change_required ? 'Test' : 'Normal'} day`;
    if (item.change_required) steps.push({ key: `change:${item.id}`, kind: 'change', action: item.action, name: item.action, caption });
    for (const question of today.questions) {
      if (asked.has(question.id) || !question.experiment_ids.includes(item.id)) continue;
      asked.add(question.id);
      const shared = question.experiment_ids.length;
      steps.push({ key: question.id, kind: 'metric', metric: question.metric, name: item.action, caption, audience: shared === 1 ? undefined : shared === 2 ? 'Counts for both' : `Counts for all ${shared}` });
    }
  }
  return <View style={styles.stack}>
    {offline && <Notice>You&apos;re offline; your answers are kept</Notice>}
    <CheckinFlow key={today.revision} steps={steps} values={{ ...values, ...Object.fromEntries(Object.entries(changes).map(([id, made]) => [`change:${id}`, made])) }} fields={fields} note={note} onNote={setNote} busy={busy} offline={offline}
      onAnswer={(key, value) => { if (key.startsWith('change:')) setChanges(current => ({ ...current, [key.slice('change:'.length)]: value as boolean })); else setValues(current => ({ ...current, [key]: value })); }}
      notice={recorded ? "Replaces today's answers." : undefined} noteCaption="Saved with every experiment here."
      alert={<>{error && <Alert>{error}</Alert>}{stale && <Action label="Reload today's check-in" secondary disabled={busy || offline} onPress={() => void reload()} />}</>}
      saveLabel={busy ? 'Saving…' : recorded ? 'Update check-in' : 'Save check-in'} onSave={() => void save()} />
  </View>;
}
