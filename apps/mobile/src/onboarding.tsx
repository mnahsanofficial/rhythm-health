import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Reanimated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StepRail } from './rails';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_LIST_ITEMS, MIN_SLEEP_HOURS, type Profile, type ProfileInput } from '@rhythm-health/contract';
import { TimeField } from './time-field';
import { Disclosure, FormRow, FormRows, Stepper } from './form-rows';
import { Icon, type IconName } from './icons';
import { goalIcon, habitIcon, stepDirection } from './lib/scene';
import { OnboardingScene } from './onboarding-scene';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { Action, Alert, Copy, Loading, PinnedTop, StickyAction, useKeyboardOpen, useStyles, Status, useScreenEnter, Notice } from './ui';
import { ApiError, saveProfile } from './lib/profile';
import { ACTIVITY_OPTIONS, AGE_OPTIONS, clearDraft, CONSTRAINTS, duration, GOALS, HABITS, habitTime, maxSleep, nightMinutes, plausible, QUESTIONS, readDraft, suggestedSleep, toProfileInput, writeDraft, type Draft, type StoredDraft } from './lib/onboarding';
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
  useScreenEnter(step, false);
  // The question slides the way you're going, while the scene above it stays put.
  const reduce = useReducedMotion();
  const previous = useRef(step);
  const slide = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    const direction = stepDirection(previous.current ?? step ?? 0, step ?? 0);
    previous.current = step;
    if (reduce || direction === 0) return;
    const timing = { duration: MOTION_DURATION_MS.step, easing: Easing.bezier(...MOTION_EASE.settle), reduceMotion: ReduceMotion.System };
    slide.set(direction * SPACING.xxl); fade.set(0);
    slide.set(withTiming(0, timing)); fade.set(withTiming(1, timing));
  }, [step, reduce, slide, fade]);
  const entering = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateX: slide.get() }] }));
  const keyboardOpen = useKeyboardOpen();
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
  const canContinue = answered || step! >= 6;
  return <View style={[styles.stack, local.fill]}>
    <PinnedTop>
      <StepRail current={step!} />
      {!keyboardOpen && <OnboardingScene step={step!} draft={draft} />}
    </PinnedTop>
    {offline && <Notice>No connection. Your answers stay on this device; reconnect to save your rhythm.</Notice>}
    {storageError && <><Alert>Couldn&apos;t keep your setup on this device. Your answers are still here while this screen is open.</Alert>
      <Action label="Try again" secondary onPress={() => persist(data)} /></>}
    <Reanimated.View style={[styles.stack, local.fill, entering]}>
      <Text ref={heading} accessibilityRole="header" accessible {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} style={styles.title}>
        {step === 0 ? 'First, your rhythm.' : step === 8 ? "Here's your rhythm." : QUESTIONS[step! - 1][0]}
      </Text>
      {step === 0 ? <>
        <Copy>Seven quick questions, nothing medical.</Copy>
        <Disclosure label="More"><Copy>Sleep, movement, goals and habits. No weights or calories. Answers stay on this device until you save.</Copy></Disclosure>
      </> : step === 8 ? <>
        <Copy>Tap a row to change it.</Copy>
        <View style={[styles.stack, local.controls]}><FormRows>
          {summaryRows.map(row => <FormRow key={row.label} compact icon={row.icon} label={row.label} value={row.value} disabled={busy || savedProfile !== null} onPress={() => persist({ ...data, step: row.step, editing: true })} />)}
        </FormRows></View>
      </> : <>
        {step === 2 ? <Status>{nightMinutes(draft) === null ? QUESTIONS[1][1] : `That's ${duration(nightMinutes(draft)!)} in bed.${plausible(draft) ? '' : ' Check the times?'}`}</Status>
          : step === 3 ? <Copy>{hours === suggestedSleep(draft) ? `Our guess, from ${duration(nightMinutes(draft) ?? 0)} in bed.` : `Out of ${duration(nightMinutes(draft) ?? 0)} in bed.`}</Copy>
          : <Copy>{QUESTIONS[step! - 1][1]}</Copy>}
        <View style={[styles.stack, local.controls]}>
        {step === 1 && <View style={local.grid}>{AGE_OPTIONS.map(o => <View key={o.value} style={local.half}><Choice label={o.label} picked={draft.age_range === o.value} onPress={() => update({ age_range: o.value })} /></View>)}</View>}
        {step === 2 && <>
          <TimeField label="Bedtime" value={draft.usual_sleep_schedule?.bedtime ?? ''} onChange={bedtime => update({ usual_sleep_schedule: { bedtime, wake_time: draft.usual_sleep_schedule?.wake_time ?? '' }, usual_sleep_hours: undefined })} />
          <TimeField label="Wake time" value={draft.usual_sleep_schedule?.wake_time ?? ''} onChange={wake_time => update({ usual_sleep_schedule: { bedtime: draft.usual_sleep_schedule?.bedtime ?? '', wake_time }, usual_sleep_hours: undefined })} />
        </>}
        {step === 3 && <Stepper label="Hours asleep" unit="hours" value={hours} lessName="Half an hour less" moreName="Half an hour more" canLess={hours > MIN_SLEEP_HOURS} canMore={hours < maxSleep(draft)}
          onLess={() => update({ usual_sleep_hours: Math.max(MIN_SLEEP_HOURS, hours - 0.5) })} onMore={() => update({ usual_sleep_hours: Math.min(maxSleep(draft), hours + 0.5) })} />}
        {step === 4 && <View style={local.grid}>{ACTIVITY_OPTIONS.map(o => <View key={o.value} style={local.half}><Choice label={o.label} hint={o.hint} picked={draft.activity_level === o.value} onPress={() => update({ activity_level: o.value })} /></View>)}</View>}
        {step === 5 && <MultiChoice key="goals" options={GOALS} iconFor={goalIcon} values={draft.goals ?? []} max={3} addLabel="Something else?" placeholder="e.g. Feel less groggy on Mondays" onChange={goals => update({ goals })} />}
        {step === 6 && <MultiChoice key="habits" options={HABITS.map(h => h.label)} iconFor={habitIcon} values={draft.regular_habits ?? []} max={MAX_LIST_ITEMS} addLabel="Something else you do most days?" placeholder="e.g. Tea before bed" onChange={regular_habits => update({ regular_habits })} />}
        {step === 7 && <MultiChoice key="constraints" options={CONSTRAINTS} values={draft.constraints ?? []} max={MAX_LIST_ITEMS} addLabel="Anything else?" placeholder="e.g. Dog walks at 7am" onChange={constraints => update({ constraints })} />}
        </View>
      </>}
      {saveError && <Alert>{saveError}</Alert>}
    </Reanimated.View>
    {step === 0 ? <StickyAction><Action wide label="Start" onPress={next} /></StickyAction>
      : step === 8 ? <StickyAction>
        {!savedProfile && !toProfileInput(draft) && <Copy style={styles.hint}>A few answers are missing.</Copy>}
        <Action wide label={busy ? 'Saving…' : savedProfile ? 'Finish saving' : 'Save my rhythm'} disabled={busy || offline || (!savedProfile && !toProfileInput(draft))} onPress={() => void save()} />
      </StickyAction>
      : <StickyAction>
        {unlock && <Copy style={styles.hint}>{unlock}</Copy>}
        <View style={local.buttons}><Action label="Previous" secondary onPress={() => editing ? persist({ ...data, step: 8, editing: false }) : go(step! - 1)} />
          <View style={local.next}><Action wide label="Continue" disabled={!canContinue} onPress={next} /></View></View>
      </StickyAction>}
  </View>;
}
function profileDraft(p: ProfileInput): Draft {
  return { age_range: p.age_range, usual_sleep_schedule: p.usual_sleep_schedule, usual_sleep_hours: p.usual_sleep_hours,
    activity_level: p.activity_level, goals: p.goals, regular_habits: p.regular_habits, constraints: p.constraints };
}
function Choice({ label, hint, picked, onPress, multiple = false, disabled = false, icon }: { label: string; hint?: string; picked: boolean; onPress: () => void; multiple?: boolean; disabled?: boolean; icon?: IconName }) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const timing = { duration: MOTION_DURATION_MS.press, reduceMotion: ReduceMotion.System };
  const choose = () => {
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); } catch { /* Fine without. */ }
    onPress();
  };
  return <Reanimated.View style={press}><Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={hint ? `${label}. ${hint}` : label}
    accessibilityState={{ checked: picked, disabled }} disabled={disabled} onPress={choose}
    onPressIn={() => { scale.set(withTiming(0.97, timing)); }} onPressOut={() => { scale.set(withTiming(1, timing)); }}
    style={[local.choice, picked && local.picked, disabled && styles.disabled]}>
    <View style={local.choiceRow}>
      {icon && <Icon name={icon} size={SPACING.md + SPACING.xs} color={picked ? COLORS['on-accent'] : COLORS.text} />}
      <Copy style={[local.choiceLabel, picked && local.pickedText]}>{icon ? (picked ? '✓ ' : '') : (picked ? '✓ ' : '○ ')}{label}</Copy>
    </View>
    {hint && <Copy style={[local.choiceHint, picked && local.pickedText]}>{hint}</Copy>}
  </Pressable></Reanimated.View>;
}
function MultiChoice({ options, values, onChange, max, addLabel, placeholder, iconFor }: { options: string[]; values: string[]; onChange: (v: string[]) => void; max: number; addLabel: string; placeholder: string; iconFor?: (option: string) => IconName }) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const [custom, setCustom] = useState(''); const [focused, setFocused] = useState(false); const chips = [...options, ...values.filter(v => !options.includes(v))];
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
    <View style={local.wrap}>
      {chips.map(chip => <Choice key={chip} icon={iconFor?.(chip)} label={chip} multiple picked={values.includes(chip)} disabled={full && !values.includes(chip)} onPress={() => onChange(values.includes(chip) ? values.filter(v => v !== chip) : [...values, chip])} />)}
    </View>
    {full && <Status style={styles.muted}>{`${values.length} of ${max} picked. Unpick one to choose another.`}</Status>}
    <View style={local.addRow}>
      <TextInput accessibilityLabel={addLabel} value={custom} onChangeText={setCustom} placeholder={placeholder} placeholderTextColor={COLORS.muted} maxLength={60} autoCorrect={false} autoCapitalize="none"
        style={[styles.input, local.addInput, focused && styles.focus]} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      <Action label="Add" secondary disabled={full || !custom.trim()} onPress={add} />
    </View>
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  buttons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  next: { flex: 1 },
  fill: { flexGrow: 1 },
  controls: { flexGrow: 1, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  half: { width: '48.5%', flexGrow: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  choice: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', paddingHorizontal: SPACING.sm + SPACING.xs, paddingVertical: SPACING.xs + 2, gap: 2, backgroundColor: COLORS.paper,
    borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control, borderRadius: RADII.control },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  choiceLabel: { flexShrink: 1 },
  choiceHint: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  picked: { backgroundColor: COLORS.moss, borderColor: COLORS.moss }, pickedText: { color: COLORS['on-accent'] },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  addInput: { flex: 1 },
}));
