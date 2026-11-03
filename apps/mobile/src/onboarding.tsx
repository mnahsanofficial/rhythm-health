import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, findNodeHandle, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS, LAYOUT, MOTION_DURATION_MS, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_LIST_ITEMS, MIN_SLEEP_HOURS, type Profile, type ProfileInput } from '@rhythm-health/contract';
import { TimeField } from './time-field';
import { Action, Alert, Copy, Loading, styles, Status } from './ui';
import { ApiError, saveProfile } from './lib/profile';
import { ACTIVITY_OPTIONS, AGE_OPTIONS, clearDraft, CONSTRAINTS, duration, GOALS, HABITS, habitTime, maxSleep, minutes, nightMinutes, plausible, QUESTIONS, readDraft, suggestedSleep, toProfileInput, writeDraft, type Draft, type StoredDraft } from './lib/onboarding';

export function Onboarding({ owner, token, offline, initial, onSaved, onExpired, onCancel }: {
  owner: string; token: string; offline: boolean; initial?: Profile; onSaved: (profile: Profile) => void; onExpired: () => void; onCancel?: () => void;
}) {
  const [data, setData] = useState<StoredDraft | null>(null);
  const [loadError, setLoadError] = useState(false); const [attempt, setAttempt] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);
  const current = useRef<StoredDraft | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const heading = useRef<React.ComponentRef<typeof Text>>(null);
  useEffect(() => {
    let active = true;
    readDraft(owner).then(stored => {
      if (!active) return;
      const value = stored ?? { draft: initial ? profileDraft(initial) : {}, step: initial ? 8 : 0, editing: false };
      current.current = value; setData(value); setLoadError(false);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [owner, initial, attempt]);
  const step = data?.step;
  useEffect(() => {
    Keyboard.dismiss();
    const node = heading.current;
    if (!node) return;
    if (Platform.OS === 'web') node.focus();
    else { const tag = findNodeHandle(node); if (tag) AccessibilityInfo.setAccessibilityFocus(tag); }
  }, [step]);
  function persist(next: StoredDraft) {
    current.current = next; setData(next); setSaveError(null);
    void writeDraft(owner, next).then(() => { if (current.current === next) setStorageError(false); })
      .catch(() => { if (current.current === next) setStorageError(true); });
  }
  if (loadError) return <View style={styles.stack}><Alert>Couldn&apos;t read your saved setup. Your account is safe.</Alert>
    <Action label="Try again" onPress={() => { setLoadError(false); setAttempt(n => n + 1); }} />
    <Action label="Start setup again" secondary onPress={() => { setLoadError(false); persist({ draft: initial ? profileDraft(initial) : {}, step: 0, editing: false }); }} />
  </View>;
  if (!data) return <Loading message="Loading your setup…" />;
  const { draft, editing } = data;
  const update = (patch: Draft) => persist({ ...data, draft: { ...draft, ...patch } });
  const go = (to: number) => persist({ ...data, step: to });
  const hours = draft.usual_sleep_hours ?? suggestedSleep(draft);
  const answered = step === 1 ? Boolean(draft.age_range) : step === 2 ? plausible(draft) : step === 3 ? plausible(draft) && hours >= MIN_SLEEP_HOURS && hours <= maxSleep(draft)
    : step === 4 ? Boolean(draft.activity_level) : step === 5 ? Boolean(draft.goals?.length) : step === 6 ? Boolean(draft.regular_habits?.length) : step === 7 ? Boolean(draft.constraints?.length) : true;
  const next = () => {
    let nextDraft = draft;
    if (step === 2) nextDraft = { ...draft, usual_sleep_hours: draft.usual_sleep_hours ?? suggestedSleep(draft) };
    if (step === 6) nextDraft = { ...draft, regular_habits: draft.regular_habits ?? [] };
    if (step === 7) nextDraft = { ...draft, constraints: draft.constraints ?? [] };
    persist({ draft: nextDraft, step: editing ? 8 : (step ?? 0) + 1, editing: false });
  };
  async function save() {
    const input = toProfileInput(draft);
    if (sending.current || offline || (!input && !savedProfile)) return;
    sending.current = true; setBusy(true); setSaveError(null);
    let wrote = savedProfile !== null;
    try {
      const profile = savedProfile ?? await saveProfile(token, input!);
      wrote = true; setSavedProfile(profile);
      await clearDraft(owner);
      if (mounted.current) onSaved(profile);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
      const fields = cause instanceof ApiError ? Object.entries(cause.fields).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join('\n') : '';
      setSaveError(wrote ? "Your rhythm is saved. Couldn't remove the on-device draft. Try again to finish."
        : `${cause instanceof ApiError && cause.status !== 0 ? `Couldn't save: ${cause.message.replace(/\.$/, '')}.` : "Couldn't reach the server."} Your answers are still here, so try again.${fields ? `\n${fields}` : ''}`);
    } finally { sending.current = false; setBusy(false); }
  }
  const summaryRows: { label: string; value: string; step: number }[] = [
    { label: 'Sleep', value: draft.usual_sleep_schedule ? `${draft.usual_sleep_schedule.bedtime} to ${draft.usual_sleep_schedule.wake_time}, about ${hours} h asleep` : 'Not answered', step: 2 },
    { label: 'Activity', value: ACTIVITY_OPTIONS.find(o => o.value === draft.activity_level)?.label ?? 'Not answered', step: 4 },
    { label: 'Goals', value: draft.goals?.join(', ') || 'Not answered', step: 5 },
    { label: 'Habits', value: draft.regular_habits?.join(', ') || 'None picked', step: 6 },
    { label: 'Limits', value: draft.constraints?.join(', ') || 'None', step: 7 },
    { label: 'Age', value: AGE_OPTIONS.find(o => o.value === draft.age_range)?.label ?? 'Not answered', step: 1 },
  ];
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.stack}>
    {offline && <Alert>No connection. Your answers stay on this device; reconnect to save your rhythm.</Alert>}
    {storageError && <><Alert>Couldn&apos;t keep your setup on this device. Your answers are still here while this screen is open.</Alert>
      <Action label="Retry keeping my answers" secondary onPress={() => persist(data)} /></>}
    {step !== 0 && step !== 8 && <>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{ min: 1, max: 7, now: step, text: `Question ${step} of 7` }} style={local.segments}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => <View key={n} style={[local.segment, n <= step! && local.segmentDone]} />)}
      </View>
      <Copy style={styles.number}>{String(step).padStart(2, '0')} / 07</Copy>
    </>}
    <Text ref={heading} accessibilityRole="header" accessible {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} style={styles.title}>
      {step === 0 ? 'First, your rhythm.' : step === 8 ? "Here's your rhythm." : QUESTIONS[step! - 1][0]}
    </Text>
    {step === 0 ? <>
      <Copy style={styles.sectionTitle}>Seven quick questions.</Copy>
      <Copy>When you usually sleep and wake, and how much of that is sleep.</Copy>
      <Copy>How much you move, and what you&apos;d like to change.</Copy>
      <Copy>The habits you already have, like coffee or late dinners.</Copy>
      <Copy style={styles.muted}>Nothing medical, and no weights or calories. Your answers stay on this device until you save your rhythm.</Copy>
      <Action label="Start" onPress={next} />
    </> : step === 8 ? <>
      <Copy style={styles.muted}>Your experiments start from here.</Copy>
      <RhythmRing draft={draft} description={false} />
      {summaryRows.map(row => <View key={row.label} style={styles.divider}>
        <Copy style={styles.muted}>{row.label}</Copy><Copy>{row.value}</Copy>
        <Action label={`Change ${row.label.toLowerCase()}`} secondary disabled={busy || savedProfile !== null} onPress={() => persist({ ...data, step: row.step, editing: true })} />
        {row.label === 'Sleep' && <Action label="Change hours asleep" secondary disabled={busy || savedProfile !== null} onPress={() => persist({ ...data, step: 3, editing: true })} />}
      </View>)}
      {!toProfileInput(draft) && <Copy>A few answers are missing. Use Change to fill them in.</Copy>}
      <Action label={busy ? 'Saving…' : savedProfile ? 'Finish saving' : 'Save my rhythm'} disabled={busy || offline || (!savedProfile && !toProfileInput(draft))} onPress={() => void save()} />
    </> : <>
      <Copy style={styles.muted}>{QUESTIONS[step! - 1][1]}</Copy>
      {step === 1 && AGE_OPTIONS.map(o => <Choice key={o.value} label={o.label} picked={draft.age_range === o.value} onPress={() => update({ age_range: o.value })} />)}
      {step === 2 && <>
        <TimeField label="Bedtime" value={draft.usual_sleep_schedule?.bedtime ?? ''} onChange={bedtime => update({ usual_sleep_schedule: { bedtime, wake_time: draft.usual_sleep_schedule?.wake_time ?? '' }, usual_sleep_hours: undefined })} />
        <TimeField label="Wake time" value={draft.usual_sleep_schedule?.wake_time ?? ''} onChange={wake_time => update({ usual_sleep_schedule: { bedtime: draft.usual_sleep_schedule?.bedtime ?? '', wake_time }, usual_sleep_hours: undefined })} />
        <Copy style={styles.muted}>Pick your usual bedtime and wake time.</Copy>
        <Status>{nightMinutes(draft) === null ? 'Enter both times.' : `That's ${duration(nightMinutes(draft)!)} in bed.${plausible(draft) ? '' : ' Check the times?'}`}</Status>
      </>}
      {step === 3 && <>
        <Copy style={styles.title} accessibilityLiveRegion="polite">{hours}</Copy><Copy>hours asleep</Copy>
        <View style={local.wrap}><Action label="Half an hour less" secondary disabled={hours <= MIN_SLEEP_HOURS} onPress={() => update({ usual_sleep_hours: Math.max(MIN_SLEEP_HOURS, hours - 0.5) })} />
          <Action label="Half an hour more" secondary disabled={hours >= maxSleep(draft)} onPress={() => update({ usual_sleep_hours: Math.min(maxSleep(draft), hours + 0.5) })} /></View>
        <Copy style={styles.muted}>{hours === suggestedSleep(draft) ? `Our guess from ${duration(nightMinutes(draft) ?? 0)} in bed. Change it if it's off.` : `Out of ${duration(nightMinutes(draft) ?? 0)} in bed.`}</Copy>
      </>}
      {(step === 2 || step === 3) && plausible(draft) && <RhythmRing draft={draft} />}
      {step === 4 && ACTIVITY_OPTIONS.map(o => <Choice key={o.value} label={o.label} hint={o.hint} picked={draft.activity_level === o.value} onPress={() => update({ activity_level: o.value })} />)}
      {step === 5 && <MultiChoice key="goals" options={GOALS} values={draft.goals ?? []} max={3} addLabel="Something else?" placeholder="e.g. Feel less groggy on Mondays" onChange={goals => update({ goals })} />}
      {step === 6 && <>
        <Copy>{draft.regular_habits?.length ?? 0} {(draft.regular_habits?.length ?? 0) === 1 ? 'habit' : 'habits'} in your rhythm. Pick what is already part of your day.</Copy>
        <MultiChoice key="habits" options={HABITS.map(h => h.label)} values={draft.regular_habits ?? []} max={MAX_LIST_ITEMS} addLabel="Something else you do most days?" placeholder="e.g. Tea before bed" onChange={regular_habits => update({ regular_habits })} />
      </>}
      {step === 7 && <>
        <Copy>{draft.constraints?.length ?? 0} {(draft.constraints?.length ?? 0) === 1 ? 'thing' : 'things'} to work around</Copy>
        <Copy style={styles.muted}>Your experiment should fit your life. These help us choose a manageable change.</Copy>
        <MultiChoice key="constraints" options={CONSTRAINTS} values={draft.constraints ?? []} max={MAX_LIST_ITEMS} addLabel="Anything else?" placeholder="e.g. Dog walks at 7am" onChange={constraints => update({ constraints })} />
      </>}
      <View style={styles.divider}><Action label="Back" secondary onPress={() => go(step! - 1)} />
        <Action label={editing ? 'Done' : !answered && step! >= 6 ? 'Skip' : 'Continue'} disabled={!answered && step! < 6} onPress={next} /></View>
    </>}
    {saveError && <Alert>{saveError}</Alert>}
    {onCancel && <Action label="Cancel setup changes" secondary disabled={busy} onPress={() => { setBusy(true); void clearDraft(owner).then(() => { if (mounted.current) onCancel(); }).catch(() => { setSaveError("Couldn't discard your setup changes. Try again."); }).finally(() => setBusy(false)); }} />}
  </View></KeyboardAvoidingView>;
}
function profileDraft(p: ProfileInput): Draft {
  return { age_range: p.age_range, usual_sleep_schedule: p.usual_sleep_schedule, usual_sleep_hours: p.usual_sleep_hours,
    activity_level: p.activity_level, goals: p.goals, regular_habits: p.regular_habits, constraints: p.constraints };
}
function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  const [focused, setFocused] = useState(false);
  return <View><Copy style={styles.label}>{label}</Copy><TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
    placeholder={placeholder} maxLength={maxLength} autoCorrect={false} autoCapitalize="none" style={[styles.input, focused && styles.focus]}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /></View>;
}
function Choice({ label, hint, picked, onPress, multiple = false, disabled = false }: { label: string; hint?: string; picked: boolean; onPress: () => void; multiple?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={hint ? `${label}. ${hint}` : label}
    accessibilityState={{ checked: picked, disabled }} disabled={disabled} onPress={onPress}
    style={[local.choice, picked && local.picked, disabled && styles.disabled]}>
    <Copy style={picked && local.pickedText}>{picked ? '✓ ' : '○ '}{label}</Copy>
    {hint && <Copy style={picked ? local.pickedText : styles.muted}>{hint}</Copy>}
  </Pressable>;
}
function MultiChoice({ options, values, onChange, max, addLabel, placeholder }: { options: string[]; values: string[]; onChange: (v: string[]) => void; max: number; addLabel: string; placeholder: string }) {
  const [custom, setCustom] = useState(''); const chips = [...options, ...values.filter(v => !options.includes(v))];
  const full = values.length >= max;
  function add() {
    const text = custom.trim().replace(/\s+/g, ' ');
    if (!text || full) return;
    const existing = chips.find(c => c.toLowerCase() === text.toLowerCase());
    if (existing) { if (!values.includes(existing)) onChange([...values, existing]); }
    else onChange([...values, text.charAt(0).toUpperCase() + text.slice(1)]);
    setCustom('');
  }
  return <View style={styles.stack}>
    {chips.map(chip => <Choice key={chip} label={chip} multiple picked={values.includes(chip)} disabled={full && !values.includes(chip)} onPress={() => onChange(values.includes(chip) ? values.filter(v => v !== chip) : [...values, chip])} />)}
    {(max === 3 || full) && <Status style={styles.muted}>{values.length} of {max} picked{full ? '. Unpick one to choose another.' : ''}</Status>}
    <Field label={addLabel} placeholder={placeholder} value={custom} maxLength={60} onChange={setCustom} />
    <Action label="Add" secondary disabled={full || !custom.trim()} onPress={add} />
  </View>;
}

function RhythmRing({ draft, description = true }: { draft: Draft; description?: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true; let animation: Animated.CompositeAnimation | undefined;
    const change = (reduce: boolean) => {
      if (!active) return;
      if (animation) { animation.stop(); opacity.setValue(1); }
      if (!reduce) { opacity.setValue(0); animation = Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION_MS.reveal, useNativeDriver: true }); animation.start(); }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(change).catch(() => { opacity.setValue(1); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', change);
    return () => { active = false; animation?.stop(); listener.remove(); };
  }, [opacity]);
  const bed = minutes(draft.usual_sleep_schedule?.bedtime ?? '') ?? 0;
  const span = nightMinutes(draft) ?? 0;
  const point = (n: number, radius = 90) => ({ x: 120 + radius * Math.sin(n / 1440 * Math.PI * 2), y: 120 - radius * Math.cos(n / 1440 * Math.PI * 2) });
  const start = point(bed); const end = point(bed + span);
  const placed = (draft.regular_habits ?? []).map(label => ({ label, time: habitTime(label, draft) }));
  return <View style={styles.stack}>
    <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity, width: '100%', maxWidth: LAYOUT.contentWidth / 5, alignSelf: 'center', aspectRatio: 1 }}>
      <Svg width="100%" height="100%" viewBox="0 0 240 240">
        <Circle cx={120} cy={120} r={90} fill="none" stroke={COLORS.line} strokeWidth={SPACING.md} />
        {span > 0 && <Path d={`M ${start.x} ${start.y} A 90 90 0 ${span > 720 ? 1 : 0} 1 ${end.x} ${end.y}`} fill="none" stroke={COLORS.night} strokeWidth={SPACING.md} strokeLinecap="round" />}
        {[0, 360, 720, 1080].map(n => { const p = point(n, 112); return <Circle key={n} cx={p.x} cy={p.y} r={LAYOUT.focusWidth} fill={COLORS.muted} />; })}
        {placed.filter(h => h.time).map(h => { const p = point(minutes(h.time!)!); return <Circle key={h.label} cx={p.x} cy={p.y} r={SPACING.sm} fill={COLORS.sun} stroke={COLORS.ink} strokeWidth={LAYOUT.focusWidth / 2} />; })}
      </Svg>
    </Animated.View>
    <Copy style={styles.muted}>Your 24-hour rhythm · midnight at the top</Copy>
    {description && <Copy>Sleep: {draft.usual_sleep_schedule?.bedtime} to {draft.usual_sleep_schedule?.wake_time}. About {draft.usual_sleep_hours ?? suggestedSleep(draft)} h asleep.</Copy>}
    {placed.map(h => <Copy key={h.label}>{h.time ? `${h.label} · ${h.time}` : `No set time, so not on the ring: ${h.label}.`}</Copy>)}
  </View>;
}
const local = StyleSheet.create({
  segments: { flexDirection: 'row', gap: SPACING.xs + 2 },
  segment: { flex: 1, height: SPACING.xs + 2, borderRadius: RADII.pill, backgroundColor: COLORS.line },
  segmentDone: { backgroundColor: COLORS.moss },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  choice: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', padding: SPACING.md, gap: SPACING.xs, backgroundColor: COLORS.paper,
    borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, borderRadius: SPACING.lg },
  picked: { backgroundColor: COLORS.moss, borderColor: COLORS.moss }, pickedText: { color: COLORS.paper },
});
