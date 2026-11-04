import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LAYOUT, MOTION_DURATION_MS, MOTION_EASE, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Experiment, LabReport, PersonalGuessComparison, PredictionComparison, ReportNarrative, SignalClass } from '@rhythm-health/contract';
import { DayChart } from './day-chart';
import { ApiError } from './lib/api';
import { getCapacity } from './lib/experiments';
import { getExperiment, getReport, reasonText, reportPercent, resultSentence, SIGNAL_COPY, writeErrorText, writeReport } from './lib/reports';
import { useNavScreen } from './nav';
import { Action, Alert, BackLink, Copy, Loading, useStyles, Title, useStepFocus, Status, Notice } from './ui';
import { useColors, themedStyles } from './theme-core';

type Load = { kind: 'loading' } | { kind: 'ready'; report: LabReport } | { kind: 'not-finished'; experiment: Experiment } | { kind: 'missing' } | { kind: 'error'; message: string };
type Props = {
  id: string; token: string; offline: boolean; initial?: LabReport; backTo?: string; onExpired: () => void; onBack: () => void; onToday: () => void; onAsk: (question: string) => void;
};

/** Reads only. Opening this screen never finishes an experiment or writes the paid narrative. */
export function LabReportScreen({ id, token, offline, initial, backTo = 'Today', onExpired, onBack, onToday, onAsk }: Props) { const pill = usePill(); const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const [load, setLoad] = useState<Load>(initial ? { kind: 'ready', report: initial } : { kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const heading = useStepFocus(load.kind);
  const needsRead = !initial;
  useEffect(() => {
    if (!needsRead || offline) return;
    let active = true;
    const fail = (cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else if (cause instanceof ApiError && cause.status === 404) setLoad({ kind: 'missing' });
      else setLoad({ kind: 'error', message: cause instanceof Error ? cause.message : "Couldn't load this. Try again." });
    };
    getReport(token, id).then(async report => {
      const next: Load = report ? { kind: 'ready', report } : { kind: 'not-finished', experiment: await getExperiment(token, id) };
      if (active) setLoad(next);
    }).catch(fail);
    return () => { active = false; };
    // A token refresh must not re-read over a written report; `attempt` is the explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, needsRead, offline, attempt]);

  useNavScreen({ kind: 'detail', onBack });
  const back = <BackLink to={backTo} onPress={onBack} />;
  if (load.kind === 'loading') return offline
    ? <View style={ui.stack}><Status>Reconnect to load this report.</Status>{back}</View>
    : <Loading message="Loading your report…" />;
  if (load.kind === 'missing') return <View style={ui.stack}><Alert>We couldn&apos;t find that experiment.</Alert>{back}</View>;
  if (load.kind === 'error') return <View style={ui.stack}>
    <Alert>{load.message}</Alert>
    <Action label="Try again" secondary disabled={offline} onPress={() => { setLoad({ kind: 'loading' }); setAttempt(n => n + 1); }} />
    {back}
  </View>;
  if (load.kind === 'not-finished') return <View style={ui.stack}>
    <Title textRef={heading}>No results yet.</Title>
    <Copy style={ui.muted}>{load.experiment.status === 'completed'
      ? "This experiment is finished, but its report isn't available. Try again in a moment."
      : 'Results appear once the experiment is finished. Keep checking in, then finish it from Today.'}</Copy>
    {back}
  </View>;

  const { report } = load;
  const { analysis, experiment, narrative } = report;
  const primary = analysis.metrics.find(metric => metric.key === analysis.primary_metric) ?? analysis.metrics[0];
  const others = analysis.metrics.filter(metric => metric.key !== primary?.key);
  const signal = SIGNAL_COPY[analysis.signal.classification];
  const a = analysis.adherence;
  // Revealing comes first, so the later steps take the primary look only once they're next.
  const nextStep = revealed || !analysis.prediction || !primary;
  const finishedOn = experiment.completed_at ? new Date(experiment.completed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
  const pair = (from: number | null, to: number | null) => from !== null && to !== null ? `${from.toFixed(1)} → ${to.toFixed(1)}` : 'Not enough data';

  return <View style={local.page}>
    {back}
    {experiment.is_seeded && <View style={local.sample}>
      <Copy style={{ color: COLORS.night }}>Sample experiment</Copy>
      <Copy style={ui.muted}>{`This report is based on seeded example check-ins${analysis.personal_guess ? ' and an invented guess' : ''}.`}</Copy>
    </View>}
    <View style={ui.stack}>
      <Copy style={local.eyebrow}>Lab Report{finishedOn ? ` · finished ${finishedOn}` : ''}</Copy>
      <Title small textRef={heading}>{experiment.question}</Title>
    </View>
    {offline && <Notice>You&apos;re offline. These results are the last ones loaded.</Notice>}

    {primary && <View style={ui.stack}>
      <Copy accessibilityRole="header" style={local.headline}>{resultSentence(primary.label, primary.percent_change, analysis.signal.classification, analysis.signal.reasons)}</Copy>
      <Copy style={local.small}>A short personal experiment shows a pattern, not proof.</Copy>
    </View>}

    {primary && <DayChart chart={report.chart} />}

    {analysis.prediction && primary
      ? <PredictionVsReality comparison={analysis.prediction} metricLabel={primary.label} guess={analysis.personal_guess} onRevealed={() => setRevealed(true)} />
      : <View style={local.card}>
        {analysis.personal_guess && <Copy>{`Your guess: ${reportPercent(analysis.personal_guess.guessed_change_percent, 2)}. A percentage comparison is unavailable because a baseline or test average is missing, or the baseline is zero.`}</Copy>}
        <Copy accessibilityRole="header" style={ui.sectionTitle}>Prediction vs reality</Copy>
        <Copy style={ui.muted}>There wasn&apos;t enough data in both phases to compare with the prediction.</Copy>
      </View>}

    {(analysis.overlaps ?? []).length > 0 && <View style={local.card}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>Other experiments at the same time</Copy>
      {analysis.overlaps.map(overlap => <Copy key={overlap.experiment_id}>{overlap.description}</Copy>)}
    </View>}

    <View style={ui.divider}>
      <Copy style={ui.muted}>Signal or noise</Copy>
      <View style={[local.pill, pill[analysis.signal.classification].box]}>
        <Copy accessibilityRole="header" style={[ui.sectionTitle, pill[analysis.signal.classification].text]}>{signal.label}</Copy>
      </View>
      <Copy style={NATIVE_TYPOGRAPHY.lead}>{signal.summary}</Copy>
      {primary && primary.percent_change !== null && <Copy style={ui.muted}>{`${primary.label}: ${reportPercent(primary.percent_change)} on test days compared with your baseline${primary.baseline.mean !== null && primary.intervention.mean !== null ? ` (${primary.baseline.mean.toFixed(1)} → ${primary.intervention.mean.toFixed(1)} on average)` : ''}.`}</Copy>}
      {analysis.signal.reasons.map(reason => <Copy key={reason}>{reasonText(reason, analysis.success_criteria_percent)}</Copy>)}
    </View>

    <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>How the days went</Copy>
      <Stat label="Baseline days logged" value={`${a.baseline_days_logged} of ${a.baseline_days_planned}`} />
      <Stat label="Test days logged" value={`${a.intervention_days_logged} of ${a.intervention_days_planned}`} />
      <Stat label="Made the change, test days" value={`${a.intervention_days_completed} of ${a.intervention_days_logged}`} />
      <Stat label="Missed" value={a.missing_days.length === 0 ? 'None' : `${a.missing_days.length === 1 ? 'Day' : 'Days'} ${a.missing_days.join(', ')}`} />
    </View>

    {others.length > 0 && <View style={ui.divider}>
      <Copy accessibilityRole="header" style={ui.sectionTitle}>The other things you tracked</Copy>
      {others.map(metric => <View key={metric.key} style={local.stat}>
        <Copy>{metric.label}</Copy>
        <Copy style={local.statValue}>{`${pair(metric.baseline.mean, metric.intervention.mean)}${metric.percent_change !== null ? ` ${reportPercent(metric.percent_change)}` : ''}`}</Copy>
      </View>)}
      <Copy style={local.small}>Baseline average → test average. Only the main measure decides the result.</Copy>
    </View>}

    <Learning nextStep={nextStep} id={experiment.id} token={token} offline={offline} seeded={experiment.is_seeded} narrative={narrative} onExpired={onExpired}
      onWritten={written => setLoad({ kind: 'ready', report: written })} />
    <NextExperiment nextStep={nextStep} token={token} offline={offline} narrative={narrative} onExpired={onExpired} onAsk={onAsk} onToday={onToday} />
  </View>;
}

const [x1, y1, x2, y2] = MOTION_EASE.settle;

/** The forecast stays fixed; a tap reveals the measured change. Reduced motion shows it at once. */
function PredictionVsReality({ comparison, metricLabel, guess, onRevealed }: { onRevealed: () => void; comparison: PredictionComparison; metricLabel: string; guess: PersonalGuessComparison | null }) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const [replay, setReplay] = useState(0);
  const [landing] = useState(() => new Animated.Value(1));
  const revealed = replay > 0;
  const { predicted_min: min, predicted_max: max, observed_change_percent: observed } = comparison;
  const guessed = guess?.guessed_change_percent;
  const lo = Math.min(0, min, observed, guessed ?? 0);
  const hi = Math.max(0, max, observed, guessed ?? 0);
  const pad = Math.max((hi - lo) * 0.15, 4);
  const at = (value: number) => ((value - (lo - pad)) / ((hi + pad) - (lo - pad))) * 100;
  const status = revealed
    ? `Your result, ${reportPercent(observed)}, landed ${comparison.within_predicted_range ? 'inside' : 'outside'} the predicted range.${guess?.error_points != null ? ` Your guess was ${Math.abs(guess.error_points)} percentage points away.` : ''}`
    : 'Compare the original forecast with what you recorded.';

  useEffect(() => {
    if (replay === 0) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      landing.setValue(0);
      animation = Animated.timing(landing, { toValue: 1, duration: MOTION_DURATION_MS.reveal, easing: Easing.bezier(x1, y1, x2, y2), useNativeDriver: true });
      animation.start();
    }).catch(() => { landing.setValue(1); });
    return () => { active = false; animation?.stop(); };
  }, [replay, landing]);
  const entering = { opacity: landing, transform: [{ translateY: landing.interpolate({ inputRange: [0, 1], outputRange: [SPACING.sm + 2, 0] }) }] };

  return <View style={local.comparison}>
    <Copy style={{ color: COLORS.night }}>Your question, put to the test</Copy>
    <Copy accessibilityRole="header" style={local.headline}>Prediction vs reality</Copy>
    <Copy style={ui.muted}>{metricLabel} · change from baseline</Copy>
    {guess ? <View style={local.guessBox}>
      <Copy>Your guess</Copy>
      <Copy style={local.big}>{reportPercent(guess.guessed_change_percent, 2)}</Copy>
      <Copy style={local.small}>Locked before you saw the AI forecast.</Copy>
    </View> : <Copy style={local.small}>No guess was recorded for this experiment.</Copy>}
    <View style={local.predicted}>
      <Copy style={{ color: COLORS.night }}>We predicted</Copy>
      <Copy style={local.big}>{`${reportPercent(min)} to ${reportPercent(max)}`}</Copy>
      <Copy style={local.small}>Recorded before your experiment began.</Copy>
    </View>
    <View style={local.saw}>
      <Copy style={{ color: COLORS.moss }}>You saw</Copy>
      {revealed ? <Animated.View style={entering}><Copy style={local.big}>{reportPercent(observed)}</Copy></Animated.View> : <Copy style={ui.muted}>Your observations are ready.</Copy>}
      <Copy style={local.small}>Measured from your recorded days.</Copy>
    </View>
    <Action label={revealed ? 'Replay comparison' : 'Compare with the prediction'} secondary={revealed} onPress={() => { setReplay(n => n + 1); onRevealed(); }} />
    <Status>{status}</Status>
    <View accessible accessibilityRole="image" accessibilityLabel={`${guess ? `Your guess ${reportPercent(guess.guessed_change_percent, 2)}; ` : ''}Predicted range ${reportPercent(min)} to ${reportPercent(max)}${revealed ? `; observed ${reportPercent(observed)}` : '; reveal to compare your result'}.`} style={local.scale}>
      <View style={local.scaleTrack} />
      <View style={[local.scaleRange, { left: `${at(min)}%`, width: `${Math.max(at(max) - at(min), 1)}%` }]} />
      <View style={[local.scaleZero, { left: `${at(0)}%` }]} />
      <Copy maxFontSizeMultiplier={1.2} style={[local.scaleLabel, { left: `${at(0)}%` }]}>0%</Copy>
      {guess && <View style={[local.diamond, { left: `${at(guess.guessed_change_percent)}%` }]} />}
      {revealed && <Animated.View style={[local.observed, { left: `${at(observed)}%` }, { opacity: landing }]} />}
    </View>
    <View style={local.legend}>
      {guess && <Copy style={local.small}>◆ Your guess</Copy>}
      <Copy style={local.small}>▬ Predicted range</Copy>
      <Copy style={local.small}>● What you saw</Copy>
    </View>
    <View style={ui.divider}>
      <Copy style={local.small}>Prediction accuracy</Copy>
      <Copy style={local.accuracy}>{revealed ? `${Math.round(comparison.accuracy_percent)}%` : 'Ready to compare'}</Copy>
      <Copy style={local.small}>How close the forecast was to the measured change. This is not scientific confidence. A short personal experiment shows a pattern, not proof.</Copy>
    </View>
  </View>;
}

type Writing = { kind: 'idle' } | { kind: 'writing' } | { kind: 'error'; status: number; message: string };

/** One paid call on an explicit tap, guarded against double taps. A failure keeps the results. */
function Learning({ id, token, offline, seeded, narrative, onExpired, onWritten, nextStep }: {
  nextStep: boolean;
  id: string; token: string; offline: boolean; seeded: boolean; narrative: ReportNarrative | null; onExpired: () => void; onWritten: (report: LabReport) => void;
}) { const local = useLocal(); const ui = useStyles();
  const [writing, setWriting] = useState<Writing>({ kind: 'idle' });
  const inFlight = useRef(false);
  async function write() {
    if (inFlight.current || offline || seeded || narrative) return;
    inFlight.current = true;
    setWriting({ kind: 'writing' });
    try {
      onWritten(await writeReport(token, id));
      setWriting({ kind: 'idle' });
      AccessibilityInfo.announceForAccessibility('Your report is written.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
      setWriting({ kind: 'error', status: cause instanceof ApiError ? cause.status : 0, message: cause instanceof Error ? cause.message : '' });
    } finally { inFlight.current = false; }
  }
  const busy = writing.kind === 'writing';
  return <View style={ui.decision}>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>What you learned about you</Copy>
    {narrative ? <>
      <Copy>{narrative.summary}</Copy>
      <Copy style={ui.muted}>{narrative.interpretation}</Copy>
      {narrative.personal_learnings.map(item => <Copy key={item}>{`• ${item}`}</Copy>)}
      {narrative.confounders.length > 0 && <Copy accessibilityRole="header">Things that may have shaped the result</Copy>}
      {narrative.confounders.map(item => <Copy key={item} style={ui.muted}>{`• ${item}`}</Copy>)}
      <Copy style={local.small}>Written from the results above. The figures on this page come from your check-ins.</Copy>
    </> : seeded ? <Copy style={ui.muted}>This sample has no written report.</Copy> : <>
      <Copy style={ui.muted}>Your results are in. We can write them up in plain words: what they suggest about you, what may have shaped them, and what to test next.</Copy>
      {writing.kind === 'error' ? <>
        <Alert>{writeErrorText(writing.status, writing.message)} Your results above are saved.</Alert>
        {writing.status !== 409 && writing.status !== 404 && writing.status !== 429 && <Action label="Try again" secondary disabled={offline} onPress={() => void write()} />}
      </> : <Action label={busy ? 'Writing your report…' : 'Write my report'} secondary={!nextStep} disabled={busy || offline} onPress={() => void write()} />}
      {busy && <Status style={local.small}>Writing your report from your results. This can take a little while; you can stay on this page.</Status>}
    </>}
  </View>;
}

type ActiveCheck = 'checking' | 'free' | { limit: number };

/** The check only chooses the wording: the backend refuses before its paid call, so a failed read doesn't block. */
function NextExperiment({ token, offline, narrative, onExpired, onAsk, onToday, nextStep }: {
  nextStep: boolean;
  token: string; offline: boolean; narrative: ReportNarrative | null; onExpired: () => void; onAsk: (question: string) => void; onToday: () => void;
}) { const local = useLocal(); const ui = useStyles();
  const [check, setCheck] = useState<ActiveCheck>('checking');
  const hasNext = narrative !== null;
  useEffect(() => {
    if (!hasNext || offline) return;
    let active = true;
    getCapacity(token)
      .then(capacity => { if (active) setCheck(capacity.can_start ? 'free' : { limit: capacity.limit }); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) onExpired();
        else setCheck('free');
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNext, offline]);
  return <View style={ui.divider}>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>What to test next</Copy>
    {narrative ? <>
      <Copy style={NATIVE_TYPOGRAPHY.lead}>{narrative.next_experiment.question}</Copy>
      <Copy style={ui.muted}>{narrative.next_experiment.reason}</Copy>
      {typeof check === 'object' ? <>
        <Copy>You&apos;re running {check.limit} experiments, the most at once. Finish one before starting this one.</Copy>
        <Action label="Go to Today" secondary onPress={onToday} />
      </> : check === 'checking' && !offline ? <Status style={local.small}>Checking whether you can start another…</Status>
        : <Action label="Run this experiment" secondary={!nextStep} onPress={() => onAsk(narrative.next_experiment.question)} />}
    </> : <>
      <Copy style={ui.muted}>A suggested next question appears once your report is written.</Copy>
      <Action label="Ask your own question" secondary onPress={() => onAsk('')} />
    </>}
  </View>;
}

function Stat({ label, value }: { label: string; value: string }) { const local = useLocal(); const ui = useStyles();
  return <View style={local.stat}><Copy style={ui.muted}>{label}</Copy><Copy style={local.statValue}>{value}</Copy></View>;
}

const usePill = themedStyles((COLORS): Record<SignalClass, { box: object; text: object }> => ({
  likely_signal: { box: { backgroundColor: COLORS.moss }, text: { color: COLORS['on-accent'] } },
  possible_signal: { box: { backgroundColor: COLORS['moss-tint'] }, text: { color: COLORS.moss } },
  unclear: { box: { backgroundColor: COLORS.line }, text: { color: COLORS.ink } },
  probably_noise: { box: { backgroundColor: COLORS.oat, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line }, text: { color: COLORS.muted } },
}));
const MARK = SPACING.md;
const useLocal = themedStyles((COLORS, mode) => { const ui = useStyles.forMode(mode); return StyleSheet.create({
  page: { gap: SPACING.xl },
  sample: { gap: SPACING.xs, borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.night, paddingLeft: SPACING.md },
  eyebrow: { color: COLORS.moss },
  small: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  card: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
  comparison: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADII.card, borderTopWidth: SPACING.xs, borderColor: COLORS.night, backgroundColor: COLORS.paper },
  headline: { ...ui.sectionTitle, ...NATIVE_TYPOGRAPHY.headline },
  guessBox: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line },
  predicted: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['night-tint'] },
  saw: { padding: SPACING.md, gap: SPACING.xs, borderRadius: RADII.card, backgroundColor: COLORS['moss-tint'] },
  big: { ...ui.number, ...NATIVE_TYPOGRAPHY.headline, color: COLORS.ink },
  accuracy: { ...ui.number, ...NATIVE_TYPOGRAPHY.title, color: COLORS.ink },
  scale: { height: LAYOUT.headerHeight },
  scaleTrack: { position: 'absolute', left: 0, right: 0, top: SPACING.lg, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.line },
  scaleRange: { position: 'absolute', top: SPACING.lg, height: SPACING.sm, borderRadius: RADII.pill, backgroundColor: COLORS.night },
  scaleZero: { position: 'absolute', top: SPACING.md, height: SPACING.lg, width: 1, backgroundColor: COLORS.muted },
  scaleLabel: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted, position: 'absolute', top: SPACING.xl + SPACING.sm, marginLeft: -SPACING.sm },
  diamond: { position: 'absolute', top: SPACING.lg - SPACING.xs, width: MARK, height: MARK, marginLeft: -MARK / 2, backgroundColor: COLORS.paper, borderWidth: LAYOUT.focusWidth, borderColor: COLORS.ink, transform: [{ rotate: '45deg' }] },
  observed: { position: 'absolute', top: SPACING.lg - SPACING.xs, width: MARK, height: MARK, marginLeft: -MARK / 2, borderRadius: RADII.pill, backgroundColor: COLORS.moss, borderWidth: LAYOUT.focusWidth, borderColor: COLORS.paper },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  pill: { alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADII.pill },
  stat: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm },
  statValue: { ...ui.number, color: COLORS.ink },
}); });
