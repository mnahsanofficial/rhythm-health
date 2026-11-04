import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { ExperimentProposal, Profile, ProposeResponse } from '@rhythm-health/contract';
import { Disclosure } from './form-rows';
import { Forecast, ForecastReasons } from './forecast';
import { ApiError, detailCode } from './lib/api';
import { listActiveExperiments } from './lib/experiments';
import { parseGuess, proposeExperiment, QUESTION_MAX, QUESTION_MIN, questionStarters, saveExperiment, signedPercent, startExperiment, TRUST_LINE } from './lib/proposals';
import { useNavScreen, WONT_BE_KEPT } from './nav';
import { PlanningMoment } from './planning-moment';
import { Action, Alert, Copy, StickyAction, useStyles, Title, useStepFocus, Status, Notice } from './ui';
import { useColors, themedStyles } from './theme-core';

type Failure = { status: number; message: string };
type Props = {
  token: string; offline: boolean; profile: Profile; initialQuestion?: string; hideStarters?: boolean; onExpired: () => void;
  /** False while another section is on show: this stays mounted, with its plan safe, but isn't what's being left. */
  shown?: boolean;
  onBack?: () => void;
  /** Where "Go to Today" leads when the experiment limit stops this flow. */
  onHome?: () => void;
  onStarted: () => void; onEditProfile?: () => void;
  /** Tells Today a plan is open, so nothing unrelated sits under it. */
  onPlanOpen?: (open: boolean) => void;
};
const message = (cause: unknown, fallback: string) => cause instanceof Error && cause.message ? cause.message : fallback;

function failureTitle({ status }: Failure) {
  if (status === 503) return 'The service is unavailable right now.';
  if (status === 502) return "We couldn't put together a complete plan.";
  if (status === 429) return "You've reached today's limit.";
  if (status === 409) return 'Your profile needs to be saved first.';
  if (status === 422) return "Let's adjust that question.";
  return "Your question hasn't been submitted successfully.";
}

/**
 * Ask, proposal, guess, reveal and start. Every paid or saving request comes from an explicit
 * tap, guarded by one synchronous lock; the result stays in this component's state, so returning
 * to the foreground or a refreshed token never asks again.
 */
export function ProposalFlow({ token, offline, profile, initialQuestion = '', hideStarters = false, shown = true, onExpired, onBack, onHome, onStarted, onEditProfile, onPlanOpen }: Props) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const [question, setQuestion] = useState(initialQuestion.length >= QUESTION_MIN && initialQuestion.length <= QUESTION_MAX ? initialQuestion : '');
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const [busy, setBusy] = useState<'proposing' | 'left' | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [guessUnavailable, setGuessUnavailable] = useState(false);
  const [limit, setLimit] = useState<string | null>(null);
  const [startAtLimit, setStartAtLimit] = useState(false);
  const blocked = limit !== null;
  const inFlight = useRef(false);
  const savedId = useRef<string | null>(null);
  const asking = useRef(0); // Leaving mid-request moves this on, so the late answer is dropped.
  const continuing = useRef(false); // The person chose Continue anyway for this question, so a retry mustn't ask again.
  const planReady = result?.safety.allowed && result.proposal && result.prediction;
  const proposing = busy === 'proposing';
  const step = proposing ? 'planning' : !planReady ? (result ? 'refused' : 'ask') : result.personal_guess_available && guess === null ? 'guess' : 'plan';
  const heading = useStepFocus(step);
  const planOpen = proposing || step === 'guess' || step === 'plan';
  useEffect(() => { onPlanOpen?.(planOpen); }, [planOpen, onPlanOpen]);
  const initial = initialQuestion.length >= QUESTION_MIN && initialQuestion.length <= QUESTION_MAX ? initialQuestion : '';
  const typed = question.trim() !== '' && question !== initial;
  // With nothing running the question is Today itself, so a × only appears once there's a plan to clear.
  const close = onBack || result || proposing ? () => {
    if (inFlight.current) { asking.current += 1; setBusy('left'); } // The lock holds until the answer lands, so nothing is paid for twice.
    if (onBack) onBack(); else reset('');
  } : undefined;
  // eslint-disable-next-line react-hooks/refs -- `close` is stored for a later press; it doesn't run during render.
  useNavScreen(shown && close ? {
    kind: 'flow', onBack: close, busy: starting, safeAtHome: true,
    unsaved: result?.proposal ? WONT_BE_KEPT.proposal : typed || proposing ? WONT_BE_KEPT.question : null,
  } : null);

  const expired = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onExpired(); return true; }
    return false;
  };
  function reset(next: string) {
    savedId.current = null; continuing.current = false;
    setQuestion(next); setResult(null); setGuess(null); setFailure(null);
    setStartError(null); setGuessUnavailable(false); setLimit(null); setStartAtLimit(false);
  }

  async function submit(continueAnyway = false) {
    const text = question.trim();
    if (inFlight.current || offline || blocked || text.length < QUESTION_MIN || text.length > QUESTION_MAX) return;
    inFlight.current = true; continuing.current = continueAnyway;
    setBusy('proposing'); setFailure(null); setResult(null); setGuess(null);
    const mine = ++asking.current;
    try {
      const response = await proposeExperiment(token, text, continueAnyway);
      if (mine !== asking.current) return;
      if (response.safety.allowed && !response.habit_check && (!response.proposal || !response.prediction)) throw new ApiError(502, 'The plan came back incomplete. Please retry.');
      if (!response.safety.allowed && !response.safety.suggested_question) setQuestion('');
      setResult(response);
    } catch (cause) {
      if (mine !== asking.current) return;
      if (cause instanceof ApiError && detailCode(cause) === 'active_limit_reached') setLimit(cause.message);
      else if (!expired(cause)) setFailure({ status: cause instanceof ApiError ? cause.status : 0, message: message(cause, 'Something went wrong. Please try again.') });
    } finally { inFlight.current = false; setBusy(null); }
  }

  async function begin(withoutGuess = false) {
    if (inFlight.current || offline || !result?.proposal || !result.prediction) return;
    inFlight.current = true;
    setStarting(true); setStartError(null); setGuessUnavailable(false); setStartAtLimit(false);
    let id = savedId.current;
    try {
      if (!id) {
        const saved = await saveExperiment(token, {
          proposal: result.proposal, prediction: result.prediction, category: result.classification.category,
          ...(guess !== null && !withoutGuess ? { personal_guess_percent: guess } : {}),
        });
        id = savedId.current = saved.id;
      }
      await startExperiment(token, id);
      onStarted();
    } catch (cause) {
      if (expired(cause)) return;
      if (cause instanceof ApiError && detailCode(cause) === 'personal_guess_unavailable') {
        setGuessUnavailable(true); setStartError(cause.message);
      } else if (id && cause instanceof ApiError && detailCode(cause) === 'active_limit_reached') {
        setStartAtLimit(true); setStartError(`Your experiment was saved, but it couldn't start yet. ${cause.message}`);
      } else if (id && cause instanceof ApiError && cause.status === 409) {
        await explainConflict(id);
      } else if (id) {
        setStartError(`Your experiment was saved, but it couldn't be started: ${message(cause, 'Try again.')}`);
      } else setStartError(message(cause, "Couldn't save your experiment. Try again."));
    } finally { inFlight.current = false; setStarting(false); }
  }

  /** A 409 can mean the earlier start did land and only its response was lost, so read before reporting. */
  async function explainConflict(id: string) {
    try {
      const active = await listActiveExperiments(token);
      if (active.some(item => item.id === id)) { onStarted(); return; }
      setStartError("Your experiment was saved, but it couldn't be started. Try again.");
    } catch (cause) {
      if (!expired(cause)) setStartError("Your experiment was saved, but we couldn't check whether it started. You can retry starting it.");
    }
  }

  const blockedNotice = limit !== null && <View style={ui.stack}>
    <Alert>{limit}</Alert>
    {onHome && <Action label="Go to Today" secondary onPress={onHome} />}
  </View>;

  if (step === 'guess' && result?.proposal) return <GuessStep heading={heading} proposal={result.proposal} shown={shown} onReveal={setGuess} onBack={() => reset('')} />;

  if (step === 'plan' && result?.proposal && result.prediction) return <View style={ui.stack}>
    {!result.personal_guess_available && <Copy accessibilityRole="text" style={local.note}>Your own guess is unavailable right now. You can still start without one.</Copy>}
    {guess !== null && <Copy style={local.locked}>Your guess: {signedPercent(guess)} change from normal days. Locked before the AI reveal.</Copy>}
    {result.classification.risk === 'review' && <View style={local.review}>
      <Copy style={local.reviewText}>A note before you begin</Copy>
      <Copy style={local.reviewText}>{result.safety.reason}</Copy>
    </View>}
    <Title textRef={heading}>{result.proposal.question}</Title>
    <PlanSummary proposal={result.proposal} />
    <Forecast prediction={result.prediction} metrics={result.proposal.metrics} />
    <Copy>Fixed once you start.</Copy>
    <Disclosure>
      <Copy>{result.proposal.hypothesis}</Copy>
      <ForecastReasons prediction={result.prediction} />
      <PlanReasons proposal={result.proposal} />
    </Disclosure>
    {offline && <Notice>You&apos;re offline. Your plan is kept; reconnect to start.</Notice>}
    {startError && <Alert>{startError}</Alert>}
    {guessUnavailable && <Action label="Skip my guess" secondary disabled={starting || offline} onPress={() => void begin(true)} />}
    {startAtLimit && onHome && <Action label="Go to Today" secondary onPress={onHome} />}
    {startError && <Action label="Try again" secondary disabled={starting || offline} onPress={() => void begin()} />}
    <Action label="Ask something else" secondary disabled={starting} onPress={() => reset('')} />
    {shown && !startError && <StickyAction><Action wide label={starting ? 'Saving your experiment…' : 'Start this experiment'} disabled={starting || offline} onPress={() => void begin()} /></StickyAction>}
  </View>;

  if (proposing) return <PlanningMoment heading={heading} question={question.trim()} />;

  const length = question.trim().length;
  const working = busy !== null;
  return <View style={ui.stack}>
    <Title textRef={heading}>Ask a question.</Title>
    <Copy>What do you want to test?</Copy>
    <View>
      <TextInput accessibilityLabel="Your question or goal" accessibilityHint="5 to 500 characters. One small change at a time." multiline value={question}
        onChangeText={value => { continuing.current = false; setQuestion(value); setResult(null); setFailure(null); setLimit(null); }} maxLength={QUESTION_MAX + 1}
        placeholder="Does walking after dinner improve my sleep?" placeholderTextColor={COLORS.muted} style={[ui.input, local.question]} />
      <View style={local.help}>
        <Copy style={local.helpText}>One small change at a time.</Copy>
        {question.length > QUESTION_MAX - 50 && <Copy style={[ui.number, local.count]}>{question.length}/{QUESTION_MAX}</Copy>}
      </View>
    </View>
    <Copy style={local.helpText}>{TRUST_LINE}</Copy>
    {offline && <Notice>You&apos;re offline. Your question is kept; reconnect to design your experiment.</Notice>}
    {!hideStarters && !result && <View accessibilityRole="none" accessibilityLabel="Suggestions" style={local.chips}>
      {questionStarters(profile.goals).map(starter => <Pressable key={starter} accessibilityRole="button" accessibilityLabel={starter} accessibilityState={{ disabled: working }} disabled={working}
        onPress={() => reset(starter)} style={({ pressed }) => [local.chip, pressed && { backgroundColor: COLORS['accent-tint'] }]}>
        <Copy>{starter}</Copy>
      </Pressable>)}
    </View>}
    {failure && <View style={ui.stack}>
      <Alert>{failureTitle(failure)} {failure.message}</Alert>
      {failure.status === 409
        ? <Action label="Go to your rhythm" secondary onPress={() => onEditProfile?.()} />
        : failure.status === 429 ? null
        : <Action label="Retry" secondary disabled={offline} onPress={() => void submit(continuing.current)} />}
    </View>}
    {blockedNotice}
    {result?.habit_check && <View style={local.fixed}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>{result.habit_check.message}</Copy>
      <Copy>{result.habit_check.suggested_question}</Copy>
      <Action label="Use this instead" onPress={() => reset(result.habit_check!.suggested_question)} />
      <Action label="Continue anyway" secondary onPress={() => void submit(true)} />
    </View>}
    {result && !result.safety.allowed && <View style={local.fixed}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Let&apos;s find a gentler experiment.</Copy>
      <Copy>{result.safety.reason || "This question isn't suitable for a small habit experiment."}</Copy>
      {result.safety.suggested_question ? <>
        <Copy>{result.safety.suggested_question}</Copy>
        <Action label="Use this instead" secondary onPress={() => reset(result.safety.suggested_question!)} />
      </> : result.safety.suggested_alternative && <Copy>{result.safety.suggested_alternative}</Copy>}
    </View>}
    {shown && !result?.habit_check && <StickyAction><Action wide label="Design experiment"
      disabled={working || offline || blocked || length < QUESTION_MIN || length > QUESTION_MAX} onPress={() => void submit()} /></StickyAction>}
  </View>;
}

function GuessStep({ heading, proposal, shown, onReveal, onBack }: {
  heading: ReturnType<typeof useStepFocus>; proposal: ExperimentProposal; shown: boolean; onReveal: (guess: number) => void; onBack: () => void;
}) { const local = useLocal(); const ui = useStyles();
  const [answer, setAnswer] = useState('');
  const [focused, setFocused] = useState(false);
  const metric = proposal.metrics.find(item => item.primary) ?? proposal.metrics[0];
  const value = parseGuess(answer);
  const reveal = () => { if (value !== null) onReveal(value); };
  return <View style={ui.stack}>
    <Title textRef={heading}>What do you think will happen?</Title>
    <Copy>{proposal.intervention.action}</Copy>
    <Copy>Change from your normal days. +10 means 10% higher.</Copy>
    <View>
      <Copy style={ui.label}>Your guess for {metric?.label}</Copy>
      <View style={local.guessRow}>
        <TextInput accessibilityLabel={`Your guess for ${metric?.label}`} accessibilityHint="Percent change from your normal days, between -100 and +200." value={answer} onChangeText={setAnswer}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} autoComplete="off" autoCorrect={false} returnKeyType="done" onSubmitEditing={reveal}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[ui.input, local.guessInput, focused && ui.focus]} />
        <Copy accessible={false} style={ui.number}>%</Copy>
      </View>
      {answer.trim() !== '' && value === null && <Status style={local.helpText}>Choose between -100 and +200.</Status>}
    </View>
    <Disclosure><Copy>It locks when you see the prediction, so your report can compare both with what happens.</Copy></Disclosure>
    <Action label="Ask something else" secondary onPress={onBack} />
    {shown && <StickyAction><Action wide label="Show prediction" disabled={value === null} onPress={reveal} /></StickyAction>}
  </View>;
}

/** What you'd do and for how long, first. The hypothesis says the same thing again, so it waits behind "Why?". */
function PlanSummary({ proposal }: { proposal: ExperimentProposal }) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const total = proposal.baseline_days + proposal.intervention_days;
  return <>
    <View style={local.change}>
      <Copy style={local.caption}>The change</Copy>
      <Copy style={local.lead}>{proposal.intervention.action}</Copy>
      <Copy>{`${proposal.intervention.timing} · ${proposal.intervention.frequency}`}</Copy>
    </View>
    <View style={ui.stack}>
      <Copy>{`${proposal.baseline_days} normal days, then ${proposal.intervention_days} test days`}</Copy>
      <View testID="plan-days" accessible accessibilityLabel={`Days 1 to ${proposal.baseline_days} are baseline. Days ${proposal.baseline_days + 1} to ${total} are test days.`} style={local.days}>
        {Array.from({ length: total }, (_, index) => <View key={index} style={[local.day, { backgroundColor: COLORS[index < proposal.baseline_days ? 'chart-1' : 'chart-2'] }]} />)}
      </View>
    </View>
  </>;
}

function PlanReasons({ proposal }: { proposal: ExperimentProposal }) {
  const primary = proposal.metrics.find(metric => metric.key === proposal.success_criteria.primary_metric)?.label ?? proposal.success_criteria.primary_metric;
  return <>
    <Copy>{`We track: ${proposal.metrics.map(metric => metric.label).join(', ')}.`}</Copy>
    <Copy>{`We look for a change of at least ${proposal.success_criteria.minimum_change_percent}% in ${primary}.`}</Copy>
  </>;
}

const useLocal = themedStyles(COLORS => StyleSheet.create({
  question: { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' },
  help: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm, marginTop: SPACING.sm },
  helpText: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  count: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  lead: { ...NATIVE_TYPOGRAPHY.lead },
  note: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.line, paddingLeft: SPACING.md },
  locked: { borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.moss, paddingLeft: SPACING.md },
  review: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['clay-tint'] },
  reviewText: { color: COLORS.clay },
  fixed: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  change: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  days: { flexDirection: 'row', gap: SPACING.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { maxWidth: '100%', minHeight: LAYOUT.primaryAction, justifyContent: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADII.control, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.control, backgroundColor: COLORS.surface },
  day: { flex: 1, height: SPACING.sm, borderRadius: RADII.pill },
  guessRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  guessInput: { flex: 1, ...NATIVE_TYPOGRAPHY.lead },
}));
