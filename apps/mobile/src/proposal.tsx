import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { COLORS, LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { ExperimentProposal, Profile, ProposeResponse } from '@rhythm-health/contract';
import { Forecast } from './forecast';
import { ApiError, detailCode } from './lib/api';
import { listActiveExperiments } from './lib/experiments';
import { parseGuess, proposeExperiment, QUESTION_MAX, QUESTION_MIN, questionStarters, saveExperiment, signedPercent, startExperiment } from './lib/proposals';
import { Action, Alert, Copy, styles as ui, Title, useStepFocus, Status } from './ui';

type Failure = { status: number; message: string; stage: 'active-check' | 'proposal' };
type Props = {
  token: string; offline: boolean; profile: Profile; initialQuestion?: string; onExpired: () => void;
  onBack: () => void; onStarted: () => void; onEditProfile?: () => void;
};
const message = (cause: unknown, fallback: string) => cause instanceof Error && cause.message ? cause.message : fallback;

function failureTitle({ status, stage }: Failure) {
  if (stage === 'active-check') return "Couldn't check for an active experiment.";
  if (status === 503) return 'The service is unavailable right now.';
  if (status === 502) return "We couldn't put together a complete plan.";
  if (status === 409) return 'Your profile needs to be saved first.';
  if (status === 422) return "Let's adjust that question.";
  return "Your question hasn't been submitted successfully.";
}

/**
 * Ask, proposal, guess, reveal and start. Every paid or saving request comes from an explicit
 * tap, guarded by one synchronous lock; the result stays in this component's state, so returning
 * to the foreground or a refreshed token never asks again.
 */
export function ProposalFlow({ token, offline, profile, initialQuestion = '', onExpired, onBack, onStarted, onEditProfile }: Props) {
  const [question, setQuestion] = useState(initialQuestion.length >= QUESTION_MIN && initialQuestion.length <= QUESTION_MAX ? initialQuestion : '');
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const [busy, setBusy] = useState<'checking' | 'proposing' | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [guessUnavailable, setGuessUnavailable] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false);
  const savedId = useRef<string | null>(null);
  const planReady = result?.safety.allowed && result.proposal && result.prediction;
  const step = !planReady ? (result ? 'refused' : 'ask') : result.personal_guess_available && guess === null ? 'guess' : 'plan';
  const heading = useStepFocus(step);

  const expired = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onExpired(); return true; }
    return false;
  };
  function reset(next: string) {
    savedId.current = null;
    setQuestion(next); setResult(null); setGuess(null); setFailure(null);
    setStartError(null); setGuessUnavailable(false); setBlocked(false);
  }

  async function submit() {
    const text = question.trim();
    if (inFlight.current || offline || text.length < QUESTION_MIN || text.length > QUESTION_MAX) return;
    inFlight.current = true;
    setBusy('checking'); setFailure(null); setBlocked(false); setResult(null); setGuess(null);
    let stage: Failure['stage'] = 'active-check';
    try {
      const [active] = await listActiveExperiments(token);
      if (active) { setBlocked(true); return; }
      stage = 'proposal';
      setBusy('proposing');
      const response = await proposeExperiment(token, text);
      if (response.safety.allowed && (!response.proposal || !response.prediction)) throw new ApiError(502, 'The plan came back incomplete. Please retry.');
      setResult(response);
    } catch (cause) {
      if (!expired(cause)) setFailure({ status: cause instanceof ApiError ? cause.status : 0, message: message(cause, 'Something went wrong. Please try again.'), stage });
    } finally { inFlight.current = false; setBusy(null); }
  }

  async function begin(withoutGuess = false) {
    if (inFlight.current || offline || !result?.proposal || !result.prediction) return;
    inFlight.current = true;
    setStarting(true); setStartError(null); setGuessUnavailable(false); setBlocked(false);
    let id = savedId.current;
    try {
      if (!id) {
        const [active] = await listActiveExperiments(token);
        if (active) { setBlocked(true); return; }
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
      } else if (id && cause instanceof ApiError && cause.status === 409) {
        await explainConflict(id);
      } else if (id) {
        setStartError(`Your experiment was saved, but it couldn't be started: ${message(cause, 'Please try again.')}`);
      } else setStartError(message(cause, "Couldn't check for an active experiment. Please try again."));
    } finally { inFlight.current = false; setStarting(false); }
  }

  /** A 409 can mean the earlier start did land and only its response was lost, so read before reporting. */
  async function explainConflict(id: string) {
    try {
      const [active] = await listActiveExperiments(token);
      if (active?.id === id) { onStarted(); return; }
      if (active) { setBlocked(true); setStartError("Your experiment was saved, but it couldn't be started because another experiment is active."); return; }
      setStartError("Your experiment was saved, but it couldn't be started. Try again.");
    } catch (cause) {
      if (!expired(cause)) setStartError("Your experiment was saved, but we couldn't check which experiment is active. You can retry starting it.");
    }
  }

  const blockedNotice = blocked && <View style={ui.stack}>
    <Alert>{startError ?? 'You already have an active experiment.'}</Alert>
    {!startError && <Copy style={ui.muted}>Finish your current experiment before designing another.</Copy>}
    <Action label="Go to your active experiment" secondary onPress={onBack} />
  </View>;

  if (step === 'guess' && result?.proposal) return <GuessStep heading={heading} proposal={result.proposal} onReveal={setGuess} onBack={() => reset('')} />;

  if (step === 'plan' && result?.proposal && result.prediction) return <View style={ui.stack}>
    {!result.personal_guess_available && <Copy accessibilityRole="text" style={local.note}>Your own guess is unavailable right now. You can still start without one.</Copy>}
    {guess !== null && <Copy style={local.locked}>Your guess: {signedPercent(guess)} change from normal days. Locked before the AI reveal.</Copy>}
    {result.classification.risk === 'review' && <View style={local.review}>
      <Copy style={local.reviewText}>A note before you begin</Copy>
      <Copy style={local.reviewText}>{result.safety.reason}</Copy>
    </View>}
    <Copy style={local.eyebrow}>Your question</Copy>
    <Title textRef={heading}>{result.proposal.question}</Title>
    <PlanDetails proposal={result.proposal} />
    <Forecast prediction={result.prediction} metrics={result.proposal.metrics} />
    <View style={local.fixed}>
      <Copy>This plan and prediction become fixed once you start.</Copy>
      <Copy style={ui.muted}>Your original forecast stays in place so you can compare it with what happens.</Copy>
    </View>
    {offline && <Status style={ui.muted}>You&apos;re offline. Your plan is kept; reconnect to start.</Status>}
    {blockedNotice}
    {startError && !blocked && <Alert>{startError}</Alert>}
    {guessUnavailable && <Action label="Continue without saving my guess" secondary disabled={starting || offline} onPress={() => void begin(true)} />}
    {startError && !blocked && <Action label="Try again" secondary disabled={starting || offline} onPress={() => void begin()} />}
    {!startError && <Action label={starting ? 'Saving your experiment…' : 'Start this experiment'} disabled={starting || offline || blocked} onPress={() => void begin()} />}
    <Action label="Ask something else" secondary disabled={starting} onPress={() => reset('')} />
  </View>;

  const length = question.trim().length;
  const working = busy !== null;
  return <View style={ui.stack}>
    <Title textRef={heading}>Ask a question.</Title>
    <Copy style={ui.muted}>What have you been wondering about your daily habits? Let&apos;s turn it into something you can test.</Copy>
    <View>
      <Copy style={ui.label}>Your question or goal</Copy>
      <TextInput accessibilityLabel="Your question or goal" accessibilityHint="5 to 500 characters. One small change at a time." multiline value={question}
        onChangeText={value => { setQuestion(value); setResult(null); setFailure(null); setBlocked(false); }} editable={!working} maxLength={QUESTION_MAX + 1}
        placeholder="Does walking after dinner improve my sleep?" placeholderTextColor={COLORS.muted} style={[ui.input, local.question]} />
      <View style={local.help}>
        <Copy style={[ui.muted, local.helpText]}>5–500 characters. One small change at a time.</Copy>
        <Copy style={[ui.number, local.count]}>{question.length}/{QUESTION_MAX}</Copy>
      </View>
    </View>
    {offline && <Status style={ui.muted}>You&apos;re offline. Your question is kept; reconnect to design your experiment.</Status>}
    <Action label={busy === 'checking' ? 'Checking your experiment…' : busy === 'proposing' ? 'Shaping your experiment…' : 'Design my experiment'}
      disabled={working || offline || blocked || length < QUESTION_MIN || length > QUESTION_MAX} onPress={() => void submit()} />
    {busy === 'checking' && <Status style={ui.muted}>Checking whether you already have an active experiment…</Status>}
    {busy === 'proposing' && <View style={ui.stack}>
      <Status>Finding a small change you can test…</Status>
      <Copy style={ui.muted}>Your plan and forecast will arrive together. This can take a little while.</Copy>
      <View accessible={false} style={ui.skeletonBody} />
    </View>}
    {failure && <View style={ui.stack}>
      <Alert>{failureTitle(failure)} {failure.message}</Alert>
      {failure.stage === 'proposal' && failure.status === 409
        ? <Action label="Go to your rhythm" secondary onPress={() => onEditProfile?.()} />
        : <Action label="Retry" secondary disabled={offline} onPress={() => void submit()} />}
    </View>}
    {blockedNotice}
    {result && !result.safety.allowed && <View style={local.fixed}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Let&apos;s find a gentler experiment.</Copy>
      <Copy style={ui.muted}>{result.safety.reason || "This question isn't suitable for a small habit experiment."}</Copy>
      {result.safety.suggested_alternative && <>
        <Copy>{result.safety.suggested_alternative}</Copy>
        <Action label="Use this instead" secondary onPress={() => reset(result.safety.suggested_alternative!)} />
      </>}
    </View>}
    <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Start with a hunch</Copy>
      <Copy style={ui.muted}>Inspired by your goals and everyday questions. Pick one, then make it yours.</Copy>
      {questionStarters(profile.goals).map(starter => <Pressable key={starter} accessibilityRole="button" accessibilityLabel={starter} accessibilityState={{ disabled: working }} disabled={working}
        onPress={() => reset(starter)} style={({ pressed }) => [local.starter, pressed && { backgroundColor: COLORS['moss-tint'] }]}>
        <Copy>{starter}</Copy>
      </Pressable>)}
    </View>
    <Action label="Back to Today" secondary disabled={working} onPress={onBack} />
  </View>;
}

function GuessStep({ heading, proposal, onReveal, onBack }: {
  heading: ReturnType<typeof useStepFocus>; proposal: ExperimentProposal; onReveal: (guess: number) => void; onBack: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [focused, setFocused] = useState(false);
  const metric = proposal.metrics.find(item => item.primary) ?? proposal.metrics[0];
  const value = parseGuess(answer);
  const reveal = () => { if (value !== null) onReveal(value); };
  return <View style={ui.stack}>
    <Copy style={local.eyebrow}>Before the AI has its say</Copy>
    <Title textRef={heading}>What do you think will happen?</Title>
    <Copy style={local.lead}>{proposal.question}</Copy>
    <Copy style={ui.muted}>The small change: {proposal.intervention.action}</Copy>
    <View>
      <Copy style={ui.label}>Your guess for {metric?.label}</Copy>
      <Copy style={[ui.muted, ui.label]}>Percent change from your normal days. Negative means down, 0 means no change, positive means up. For example, +10 means 10% higher. Choose between -100 and +200.</Copy>
      <View style={local.guessRow}>
        <TextInput accessibilityLabel={`Your guess for ${metric?.label}`} accessibilityHint="Percent change from your normal days, between -100 and +200." value={answer} onChangeText={setAnswer}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} autoComplete="off" autoCorrect={false} returnKeyType="done" onSubmitEditing={reveal}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[ui.input, local.guessInput, focused && ui.focus]} />
        <Copy accessible={false} style={ui.number}>%</Copy>
      </View>
    </View>
    <Copy style={ui.muted}>Your guess locks when you reveal the AI prediction. It is saved if you start the experiment, so your report can compare both with what happens.</Copy>
    <Action label="Reveal the AI prediction" disabled={value === null} onPress={reveal} />
    <Action label="Ask something else" secondary onPress={onBack} />
  </View>;
}

function PlanDetails({ proposal }: { proposal: ExperimentProposal }) {
  const total = proposal.baseline_days + proposal.intervention_days;
  const primary = proposal.metrics.find(metric => metric.key === proposal.success_criteria.primary_metric)?.label ?? proposal.success_criteria.primary_metric;
  return <>
    <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>The hypothesis</Copy>
      <Copy style={ui.muted}>{proposal.hypothesis}</Copy>
    </View>
    <View style={local.change}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>The small change</Copy>
      <Copy>{proposal.intervention.action}</Copy>
      <Copy style={ui.muted}>When: {proposal.intervention.timing}</Copy>
      <Copy style={ui.muted}>How often: {proposal.intervention.frequency}</Copy>
    </View>
    <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>{`A ${total}-day timeline`}</Copy>
      <Copy style={ui.muted}>{`${proposal.baseline_days} baseline · ${proposal.intervention_days} test`}</Copy>
      <View accessible accessibilityLabel={`Days 1 to ${proposal.baseline_days} are baseline. Days ${proposal.baseline_days + 1} to ${total} are test days.`} style={local.days}>
        {Array.from({ length: total }, (_, index) => {
          const baseline = index < proposal.baseline_days;
          return <View key={index} style={[local.day, { backgroundColor: COLORS[baseline ? 'night-tint' : 'moss-tint'] }]}>
            <Copy style={[ui.number, local.dayNumber, { color: COLORS[baseline ? 'night' : 'moss'] }]}>{index + 1}</Copy>
          </View>;
        })}
      </View>
    </View>
    <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>What we&apos;ll notice</Copy>
      {proposal.metrics.map(metric => <View key={metric.key} style={local.metric}>
        <Copy>{metric.label}</Copy>
        {metric.primary && <Copy style={ui.muted}>Primary</Copy>}
      </View>)}
      <Copy style={ui.muted}>{`We look for a change of at least ${proposal.success_criteria.minimum_change_percent}% in ${primary}.`}</Copy>
    </View>
  </>;
}

const local = StyleSheet.create({
  question: { minHeight: LAYOUT.primaryAction * 2, textAlignVertical: 'top' },
  help: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm, marginTop: SPACING.sm },
  helpText: { ...NATIVE_TYPOGRAPHY.caption },
  count: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  eyebrow: { color: COLORS.moss },
  lead: { ...NATIVE_TYPOGRAPHY.lead },
  note: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.line, paddingLeft: SPACING.md },
  locked: { borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.moss, paddingLeft: SPACING.md },
  review: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['clay-tint'] },
  reviewText: { color: COLORS.clay },
  fixed: { padding: SPACING.md, gap: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  change: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, backgroundColor: COLORS.paper },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  day: { minWidth: LAYOUT.tapTarget, minHeight: LAYOUT.tapTarget, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.pill },
  dayNumber: { ...NATIVE_TYPOGRAPHY.caption },
  metric: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm },
  guessRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  guessInput: { flex: 1, ...NATIVE_TYPOGRAPHY.lead },
  starter: { minHeight: LAYOUT.primaryAction, justifyContent: 'center', paddingVertical: SPACING.sm, borderTopWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
});
