import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, findNodeHandle, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedDefault, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { StepRail } from './rails';
import { LAYOUT, MOTION_DURATION_MS, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_LIST_ITEMS, MIN_SLEEP_HOURS, type Profile, type ProfileInput } from '@rhythm-health/contract';
import { TimeField } from './time-field';
import { Disclosure, FormRow, FormRows, Stepper } from './form-rows';
import type { IconName } from './icons';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { Action, Alert, Copy, Loading, StickyAction, useStyles, Status, useScreenEnter, Notice } from './ui';
import { ApiError, saveProfile } from './lib/profile';
import { ACTIVITY_OPTIONS, AGE_OPTIONS, clearDraft, CONSTRAINTS, duration, GOALS, HABITS, habitTime, maxSleep, minutes, nightMinutes, plausible, QUESTIONS, readDraft, suggestedSleep, toProfileInput, writeDraft, type Draft, type StoredDraft } from './lib/onboarding';
import { useColors, themedStyles } from './theme-core';

export function Onboarding({ owner, token, offline, initial, onSaved, onExpired, onCancel }: {
  owner: string; token: string; offline: boolean; initial?: Profile; onSaved: (profile: Profile) => void; onExpired: () => void; onCancel?: () => void;
}) { const local = useLocal(); const styles = useStyles();
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
  const changed = initial !== undefined && data !== null && JSON.stringify(data.draft) !== JSON.stringify(profileDraft(initial));
  // Editing a saved rhythm can be closed. The first time through there's nowhere to go back to.
  useNavScreen(onCancel && data ? {
    kind: 'flow', busy, unsaved: changed ? WONT_BE_KEPT.changes : null,
    onBack: () => { setBusy(true); void clearDraft(owner).then(() => { if (mounted.current) onCancel(); }).catch(() => { setSaveError("Couldn't discard your setup changes. Try again."); }).finally(() => setBusy(false)); },
  } : null);
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
  useScreenEnter(step);
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
  const habitsWithTimes = (draft.regular_habits ?? []).map(label => { const time = habitTime(label, draft); return time ? `${label} · ${time}` : label; }).join(', ');
  const summaryRows: { label: string; value: string; step: number; icon: IconName }[] = [
    { label: 'Sleep', value: draft.usual_sleep_schedule ? `${draft.usual_sleep_schedule.bedtime} to ${draft.usual_sleep_schedule.wake_time}` : 'Not answered', step: 2, icon: 'sleep' },
    { label: 'Hours asleep', value: draft.usual_sleep_schedule ? `About ${hours} h` : 'Not answered', step: 3, icon: 'hours' },
    { label: 'Activity', value: ACTIVITY_OPTIONS.find(o => o.value === draft.activity_level)?.label ?? 'Not answered', step: 4, icon: 'move' },
    { label: 'Goals', value: draft.goals?.join(', ') || 'Not answered', step: 5, icon: 'goals' },
    { label: 'Habits', value: habitsWithTimes || 'None picked', step: 6, icon: 'habits' },
    { label: 'Limits', value: draft.constraints?.join(', ') || 'None', step: 7, icon: 'limits' },
    { label: 'Age', value: AGE_OPTIONS.find(o => o.value === draft.age_range)?.label ?? 'Not answered', step: 1, icon: 'age' },
  ];
  /** Said where the disabled button is, in place of an error nobody has earned yet. */
  const unlock = answered || step! >= 6 ? null : step === 2 ? (nightMinutes(draft) === null ? 'Pick both times to continue.' : 'Check the times to continue.') : step === 5 ? 'Pick at least one to continue.' : 'Pick one to continue.';
  return <View style={styles.stack}>
    {offline && <Notice>No connection. Your answers stay on this device; reconnect to save your rhythm.</Notice>}
    {storageError && <><Alert>Couldn&apos;t keep your setup on this device. Your answers are still here while this screen is open.</Alert>
      <Action label="Try again" secondary onPress={() => persist(data)} /></>}
    {step !== 0 && step !== 8 && <>
      <StepRail current={step!} />
    </>}
    <Text ref={heading} accessibilityRole="header" accessible {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} style={styles.title}>
      {step === 0 ? 'First, your rhythm.' : step === 8 ? "Here's your rhythm." : QUESTIONS[step! - 1][0]}
    </Text>
    {step === 0 ? <>
      <Copy>Seven quick questions, nothing medical.</Copy>
      <Disclosure label="More"><Copy>Sleep, movement, goals and habits. No weights or calories. Answers stay on this device until you save.</Copy></Disclosure>
      <StickyAction><Action wide label="Start" onPress={next} /></StickyAction>
    </> : step === 8 ? <>
      <Copy>Tap a row to change it.</Copy>
      <RhythmRing draft={draft} description={false} />
      <FormRows>
        {summaryRows.map(row => <FormRow key={row.label} icon={row.icon} label={row.label} value={row.value} disabled={busy || savedProfile !== null} onPress={() => persist({ ...data, step: row.step, editing: true })} />)}
      </FormRows>
      <StickyAction>
        {!savedProfile && !toProfileInput(draft) && <Copy style={styles.hint}>A few answers are missing.</Copy>}
        <Action wide label={busy ? 'Saving…' : savedProfile ? 'Finish saving' : 'Save my rhythm'} disabled={busy || offline || (!savedProfile && !toProfileInput(draft))} onPress={() => void save()} />
      </StickyAction>
    </> : <>
      {QUESTIONS[step! - 1][1] !== '' && <Copy>{QUESTIONS[step! - 1][1]}</Copy>}
      {step === 1 && AGE_OPTIONS.map(o => <Choice key={o.value} label={o.label} picked={draft.age_range === o.value} onPress={() => update({ age_range: o.value })} />)}
      {step === 2 && <>
        <TimeField label="Bedtime" value={draft.usual_sleep_schedule?.bedtime ?? ''} onChange={bedtime => update({ usual_sleep_schedule: { bedtime, wake_time: draft.usual_sleep_schedule?.wake_time ?? '' }, usual_sleep_hours: undefined })} />
        <TimeField label="Wake time" value={draft.usual_sleep_schedule?.wake_time ?? ''} onChange={wake_time => update({ usual_sleep_schedule: { bedtime: draft.usual_sleep_schedule?.bedtime ?? '', wake_time }, usual_sleep_hours: undefined })} />
        {nightMinutes(draft) !== null && <Status>{`That's ${duration(nightMinutes(draft)!)} in bed.${plausible(draft) ? '' : ' Check the times?'}`}</Status>}
      </>}
      {step === 3 && <>
        <Stepper label="Hours asleep" unit="hours" value={hours} lessName="Half an hour less" moreName="Half an hour more" canLess={hours > MIN_SLEEP_HOURS} canMore={hours < maxSleep(draft)}
          onLess={() => update({ usual_sleep_hours: Math.max(MIN_SLEEP_HOURS, hours - 0.5) })} onMore={() => update({ usual_sleep_hours: Math.min(maxSleep(draft), hours + 0.5) })} />
        <Copy>{hours === suggestedSleep(draft) ? `Our guess, from ${duration(nightMinutes(draft) ?? 0)} in bed.` : `Out of ${duration(nightMinutes(draft) ?? 0)} in bed.`}</Copy>
      </>}
      {step === 4 && ACTIVITY_OPTIONS.map(o => <Choice key={o.value} label={o.label} hint={o.hint} picked={draft.activity_level === o.value} onPress={() => update({ activity_level: o.value })} />)}
      {step === 5 && <MultiChoice key="goals" options={GOALS} values={draft.goals ?? []} max={3} addLabel="Something else?" placeholder="e.g. Feel less groggy on Mondays" onChange={goals => update({ goals })} />}
      {step === 6 && <MultiChoice key="habits" options={HABITS.map(h => h.label)} values={draft.regular_habits ?? []} max={MAX_LIST_ITEMS} addLabel="Something else you do most days?" placeholder="e.g. Tea before bed" onChange={regular_habits => update({ regular_habits })} />}
      {step === 7 && <MultiChoice key="constraints" options={CONSTRAINTS} values={draft.constraints ?? []} max={MAX_LIST_ITEMS} addLabel="Anything else?" placeholder="e.g. Dog walks at 7am" onChange={constraints => update({ constraints })} />}
      {step! >= 2 && plausible(draft) && <Disclosure label="Your rhythm so far"><RhythmSoFar draft={draft} /></Disclosure>}
      <StickyAction>
        {unlock && <Copy style={styles.hint}>{unlock}</Copy>}
        <View style={local.buttons}><Action label="Previous" secondary onPress={() => go(step! - 1)} />
          <View style={local.next}><Action wide label={editing ? 'Done' : !answered && step! >= 6 ? 'Skip' : 'Continue'} disabled={!answered && step! < 6} onPress={next} /></View></View>
      </StickyAction>
    </>}
    {saveError && <Alert>{saveError}</Alert>}
  </View>;
}
function profileDraft(p: ProfileInput): Draft {
  return { age_range: p.age_range, usual_sleep_schedule: p.usual_sleep_schedule, usual_sleep_hours: p.usual_sleep_hours,
    activity_level: p.activity_level, goals: p.goals, regular_habits: p.regular_habits, constraints: p.constraints };
}
function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) { const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return <View><Copy style={styles.label}>{label}</Copy><TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
    placeholder={placeholder} maxLength={maxLength} autoCorrect={false} autoCapitalize="none" style={[styles.input, focused && styles.focus]}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /></View>;
}
function Choice({ label, hint, picked, onPress, multiple = false, disabled = false }: { label: string; hint?: string; picked: boolean; onPress: () => void; multiple?: boolean; disabled?: boolean }) { const local = useLocal(); const styles = useStyles();
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={hint ? `${label}. ${hint}` : label}
    accessibilityState={{ checked: picked, disabled }} disabled={disabled} onPress={onPress}
    style={[local.choice, picked && local.picked, disabled && styles.disabled]}>
    <Copy style={picked && local.pickedText}>{picked ? '✓ ' : '○ '}{label}</Copy>
    {hint && <Copy style={picked ? local.pickedText : styles.muted}>{hint}</Copy>}
  </Pressable>;
}
function MultiChoice({ options, values, onChange, max, addLabel, placeholder }: { options: string[]; values: string[]; onChange: (v: string[]) => void; max: number; addLabel: string; placeholder: string }) { const styles = useStyles();
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

/** Takes shape under the questions as answers arrive, so it never pushes a question off the screen. */
function RhythmSoFar({ draft }: { draft: Draft }) { const styles = useStyles();
  const facts: [string, string | undefined][] = [
    ['Activity', ACTIVITY_OPTIONS.find(o => o.value === draft.activity_level)?.label],
    ['Goals', draft.goals?.join(', ') || undefined],
  ];
  return <View style={styles.stack}>
    <RhythmRing draft={draft} />
    {facts.filter(([, value]) => value).map(([label, value]) => <ReanimatedView key={label} entering={FadeInDown.duration(MOTION_DURATION_MS.response).reduceMotion(ReduceMotion.System)} style={{ gap: SPACING.xs }}>
      <Copy style={styles.muted}>{label}</Copy><Copy>{value}</Copy>
    </ReanimatedView>)}
  </View>;
}

function RhythmRing({ draft, description = true }: { draft: Draft; description?: boolean }) { const COLORS = useColors(); const styles = useStyles();
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
    <Copy style={styles.hint}>Midnight at the top</Copy>
    {description && <Copy>Sleep: {draft.usual_sleep_schedule?.bedtime} to {draft.usual_sleep_schedule?.wake_time}. About {draft.usual_sleep_hours ?? suggestedSleep(draft)} h asleep.</Copy>}
    {description && placed.map(h => <Copy key={h.label}>{h.time ? `${h.label} · ${h.time}` : `No set time, so not on the ring: ${h.label}.`}</Copy>)}
  </View>;
}
const ReanimatedView = ReanimatedDefault.View;
const useLocal = themedStyles(COLORS => StyleSheet.create({
  buttons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  next: { flex: 1 },
  choice: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', padding: SPACING.md, gap: SPACING.xs, backgroundColor: COLORS.paper,
    borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control, borderRadius: RADII.control },
  picked: { backgroundColor: COLORS.moss, borderColor: COLORS.moss }, pickedText: { color: COLORS['on-accent'] },
}));
