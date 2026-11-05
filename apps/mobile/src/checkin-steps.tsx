import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { FONT_FAMILIES, LAYOUT, MOTION_DURATION_MS, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import { MAX_NOTE_LENGTH, type Metric } from '@rhythm-health/contract';
import { CheckinScene } from './checkin-scene';
import { Icon } from './icons';
import { MetricInput, Radio, scaleCaption } from './metric-input';
import { CHECKIN_ADVANCE_MS } from './lib/checkin-scene';
import { metricAnswer } from './lib/checkins';
import { themedStyles, useColors } from './theme-core';
import { Action, BackLink, Copy, StickyAction, Title, useFillScreen, useStepFocus, useStyles } from './ui';

export type CheckinStep = { key: string; caption?: string; name?: string; audience?: string; day?: number | null } & (
  | { kind: 'change'; action: string }
  | { kind: 'metric'; metric: Metric }
);
export type Answer = string | boolean | undefined;

const typed = (metric: Metric) => metric.type === 'number' || metric.type === 'duration' || (metric.type === 'scale' && (metric.max ?? 10) - (metric.min ?? 1) > 20);
const valid = (step: CheckinStep, value: Answer) => step.kind === 'change' ? typeof value === 'boolean' : !('error' in metricAnswer(step.metric, value));
const stepLabel = (step: CheckinStep) => step.kind === 'metric' ? step.metric.label : step.name ?? 'Made the change';
const shown = (step: CheckinStep, value: Answer) => {
  if (value === undefined || value === '') return 'Not answered';
  if (step.kind === 'change') return value ? 'Yes' : 'Not today';
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
};

/** One step at a time. A step slides in from the side it comes from; Reduce Motion only swaps it. */
function Slide({ direction, children }: { direction: 1 | -1; children: ReactNode }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(reduce ? 0 : direction * SPACING.xl);
  const opacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { x.set(0); opacity.set(1); return; }
    const timing = { duration: MOTION_DURATION_MS.response, reduceMotion: ReduceMotion.System };
    x.set(withTiming(0, timing)); opacity.set(withTiming(1, timing));
  }, [reduce, x, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateX: x.get() }] }));
  return <Animated.View testID="checkin-step" style={[{ gap: SPACING.md, flexGrow: 1 }, style]}>{children}</Animated.View>;
}

function Dots({ now, total }: { now: number; total: number }) { const local = useLocal();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${now} of ${total}`} accessibilityValue={{ min: 1, max: total, now }} style={local.dots}>
    {Array.from({ length: total }, (_, index) => <View key={index} testID="checkin-dot" style={[local.dot, index < now && local.dotDone]} />)}
  </View>;
}

function Top({ step, now, total }: { step?: CheckinStep; now: number; total: number }) { const local = useLocal();
  return <View style={local.top}>
    <Dots now={now} total={total} />
    {step?.name && <Copy numberOfLines={1} style={local.name}>{step.name}</Copy>}
    {step?.caption && <Copy style={local.caption}>{step.caption}</Copy>}
  </View>;
}

/**
 * One question fills the phone without scrolling: the words at the top, the scene in the middle, and the answers in
 * the bottom bar, where the thumb is. A tap lets the scene move to the answer and hold, then goes on. Reduce Motion goes on at once.
 */
function Question({ step, value, error, busy, onAnswer, onNext, onBack }: { step: CheckinStep; value: Answer; error?: string; busy: boolean; onAnswer: (value: string | boolean) => void; onNext: () => void; onBack?: () => void }) {
  const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const heading = useStepFocus(step.key);
  const reduce = useReducedMotion();
  useFillScreen();
  const isTyped = step.kind === 'metric' && typed(step.metric);
  // Decided on arrival: a new tap goes on by itself, so Next appearing under it would only move the buttons.
  const [arrivedAnswered] = useState(value !== undefined && value !== '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tapped = (next: string | boolean) => {
    clearTimeout(timer.current);
    onAnswer(next);
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); } catch { /* A phone without haptics still moves on. */ }
    if (reduce) onNext();
    else timer.current = setTimeout(onNext, CHECKIN_ADVANCE_MS);
  };
  return <>
    <Title textRef={heading}>{step.kind === 'change' ? 'Did you make the change?' : step.metric.label}</Title>
    {step.kind === 'change' && !step.name && <Copy>{step.action}</Copy>}
    {step.audience && <Copy style={local.caption}>{step.audience}</Copy>}
    {step.kind === 'metric' && step.metric.type === 'scale' && !isTyped && <Copy style={styles.muted}>{scaleCaption(step.metric)}</Copy>}
    <CheckinScene step={step} value={value} />
    <StickyAction>
      {error && <Copy style={{ color: COLORS.clay }}>{error}</Copy>}
      {step.kind === 'change'
        ? <View accessibilityRole="radiogroup" accessibilityLabel="Did you make the change?" style={local.pair}>
          <View style={local.half}><Radio big label="Yes, I made the change" text="Yes" selected={value === true} disabled={busy} onPress={() => tapped(true)} /></View>
          <View style={local.half}><Radio big label="Not today" selected={value === false} disabled={busy} onPress={() => tapped(false)} /></View>
        </View>
        : <MetricInput big metric={step.metric} value={value} disabled={busy} onChange={next => { if (isTyped) onAnswer(next); else tapped(next); }} />}
      {(isTyped || arrivedAnswered) && <Action wide label="Next" disabled={busy || !valid(step, value)} onPress={() => { clearTimeout(timer.current); onNext(); }} />}
      {onBack && <BackLink to="Back" name="Back" disabled={busy} onPress={onBack} />}
    </StickyAction>
  </>;
}

function Review({ steps, values, fields, note, onNote, busy, notice, noteCaption, alert, offline, saveLabel, onEdit, onSave }: {
  steps: CheckinStep[]; values: Record<string, Answer>; fields: Record<string, string>; note: string; onNote: (note: string) => void; busy: boolean;
  notice?: string; noteCaption?: string; alert?: ReactNode; offline: boolean; saveLabel: string; onEdit: (index: number) => void; onSave: () => void;
}) { const COLORS = useColors(); const local = useLocal(); const styles = useStyles();
  const heading = useStepFocus('review');
  const [noting, setNoting] = useState(note !== '');
  return <>
    <Title textRef={heading}>Review</Title>
    {notice && <Copy style={local.caption}>{notice}</Copy>}
    {alert}
    <View>
      {steps.map((step, index) => { const value = values[step.key]; const done = valid(step, value); const label = stepLabel(step); return <View key={step.key}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label}, ${shown(step, value)}`} disabled={busy} onPress={() => onEdit(index)} style={({ pressed }) => [local.row, pressed && { backgroundColor: COLORS['moss-tint'] }]}>
          {done ? <Icon name="check" size={SPACING.lg} color={COLORS.moss} filled /> : <View style={local.missing} />}
          <Copy numberOfLines={1} style={local.rowLabel}>{label}</Copy>
          <Copy style={styles.number}>{done ? shown(step, value) : '–'}</Copy>
        </Pressable>
        {fields[step.key] && <Copy style={{ color: COLORS.clay }}>{fields[step.key]}</Copy>}
      </View>; })}
    </View>
    {noting ? <View style={styles.stack}>
      <TextInput accessibilityLabel="Optional note" multiline value={note} onChangeText={onNote} maxLength={MAX_NOTE_LENGTH} editable={!busy}
        placeholder="Late night, a long run…" placeholderTextColor={COLORS.muted} style={[styles.input, local.note]} />
      {noteCaption && <Copy style={local.caption}>{noteCaption}</Copy>}
      {fields.note && <Copy style={{ color: COLORS.clay }}>{fields.note}</Copy>}
    </View> : <Pressable accessibilityRole="button" accessibilityLabel="Add a note" onPress={() => setNoting(true)} style={local.addNote}><Copy>Add a note ›</Copy></Pressable>}
    <StickyAction><Action wide label={saveLabel} disabled={busy || offline} onPress={onSave} /></StickyAction>
  </>;
}

/** Each question on its own screen, then a short review, then Save. Editing an existing check-in is the same flow, prefilled. */
export function CheckinFlow({ steps, values, onAnswer, fields, note, onNote, busy, offline, notice, noteCaption, alert, top, saveLabel, onSave }: {
  steps: CheckinStep[]; values: Record<string, Answer>; onAnswer: (key: string, value: string | boolean) => void; fields: Record<string, string>; note: string; onNote: (note: string) => void;
  busy: boolean; offline: boolean; notice?: string; noteCaption?: string; alert?: ReactNode; top?: ReactNode; saveLabel: string; onSave: () => void;
}) { const styles = useStyles(); const local = useLocal();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [returning, setReturning] = useState(false); // Changing one answer from the review goes straight back to it.
  const total = steps.length + 1;
  const go = (next: number) => { setDirection(next < index ? -1 : 1); setIndex(next); };
  const forward = () => { if (returning) { setReturning(false); go(steps.length); } else go(index + 1); };
  const back = () => { setReturning(false); go(index - 1); };
  const step = steps[index];
  return <View style={[styles.stack, local.fill]}>
    {top}
    <Top step={step} now={index + 1} total={total} />
    <Slide key={step?.key ?? 'review'} direction={direction}>
      {step
        ? <Question step={step} value={values[step.key]} error={fields[step.key]} busy={busy} onNext={forward}
          onAnswer={value => onAnswer(step.key, value)} onBack={index > 0 ? back : undefined} />
        : <Review steps={steps} values={values} fields={fields} note={note} onNote={onNote} busy={busy} notice={notice} noteCaption={noteCaption} alert={alert} offline={offline}
          saveLabel={saveLabel} onSave={onSave} onEdit={next => { setReturning(true); go(next); }} />}
    </Slide>
    {!step && <BackLink to="Back" name="Back" disabled={busy} onPress={back} />}
  </View>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  fill: { flexGrow: 1 },
  top: { gap: SPACING.sm },
  dots: { flexDirection: 'row', gap: SPACING.sm },
  dot: { width: SPACING.sm, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.line },
  dotDone: { backgroundColor: COLORS.moss },
  name: { fontFamily: FONT_FAMILIES.sansMedium },
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  pair: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1 },
  row: { minHeight: LAYOUT.primaryAction, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderBottomWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  rowLabel: { flex: 1 },
  missing: { width: SPACING.sm, height: SPACING.sm, margin: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.clay },
  note: { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' },
  addNote: { minHeight: LAYOUT.primaryAction, justifyContent: 'center' },
}));
