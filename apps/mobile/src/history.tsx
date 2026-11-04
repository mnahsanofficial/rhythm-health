import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, RADII, SPACING } from '@rhythm-health/brand';
import type { Experiment, LabReport } from '@rhythm-health/contract';
import { ApiError } from './lib/api';
import { listCompletedExperiments, resetDemo } from './lib/history';
import { getReport, reportPercent, SIGNAL_COPY } from './lib/reports';
import { Action, Alert, Copy, Loading, useStyles, Title, useStepFocus, Status } from './ui';
import { useColors, themedStyles } from './theme-core';

/** Held by Today for this app session, so going offline can still show what was read. Not an offline database. */
export type HistoryCache = { value: { experiments: Experiment[]; at: Date; reports: Record<string, LabReport | null> } | null };

const expired = (cause: unknown) => cause instanceof ApiError && cause.status === 401;
const stamp = (item: Experiment) => Date.parse(item.completed_at ?? item.created_at) || 0;

export function HistoryScreen({ token, offline, cache, onExpired, onOpen, onAsk }: {
  token: string; offline: boolean; cache: HistoryCache; onExpired: () => void;
  onOpen: (id: string, cached?: LabReport) => void; onAsk: () => void;
}) { const local = useLocal(); const ui = useStyles();
  const [list, setList] = useState<Experiment[] | null>(cache.value?.experiments ?? null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const heading = useStepFocus('history');
  useEffect(() => {
    if (offline) return;
    let active = true;
    listCompletedExperiments(token).then(experiments => {
      if (!active) return;
      cache.value = { experiments, at: new Date(), reports: cache.value?.reports ?? {} };
      setList(experiments); setError(null);
    }).catch((cause: unknown) => {
      if (!active) return;
      if (expired(cause)) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load this. Try again.");
    });
    return () => { active = false; };
    // A refreshed token is not a reason to read again; `attempt` is the explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, attempt]);

  const ordered = [...(list ?? [])].sort((a, b) => order === 'newest' ? stamp(b) - stamp(a) : stamp(a) - stamp(b));
  const at = cache.value?.at;
  return <View style={local.page}>
    <View style={ui.stack}>
      <Copy style={local.eyebrow}>What you&apos;ve learned</Copy>
      <Title textRef={heading}>Your experiment history</Title>
      <Copy style={ui.muted}>Look back at your predictions and the patterns your experiments found.</Copy>
    </View>
    {offline && (at
      ? <Status style={ui.muted}>{`Offline, last updated ${at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`}</Status>
      : <Status>Reconnect to load your history.</Status>)}
    {!offline && error && <View style={ui.stack}>
      <Alert>We couldn&apos;t load your history. {error}</Alert>
      <Action label="Try again" secondary onPress={() => { setError(null); setAttempt(n => n + 1); }} />
    </View>}
    {list === null ? (!offline && !error && <Loading message="Loading your history…" />)
      : list.length === 0 ? <View style={local.empty}>
        <Copy accessibilityRole="header" style={ui.sectionTitle}>Nothing finished yet.</Copy>
        <Copy style={ui.muted}>Completed experiments will appear here.</Copy>
        <Action label="Test a new question" onPress={onAsk} />
      </View> : <View style={ui.stack}>
        <Status style={local.count}>{`${ordered.length} completed ${ordered.length === 1 ? 'experiment' : 'experiments'} · ${order} first`}</Status>
        <View style={local.sort}>
          <Action label="Newest first" secondary={order !== 'newest'} selected={order === 'newest'} onPress={() => setOrder('newest')} />
          <Action label="Oldest first" secondary={order !== 'oldest'} selected={order === 'oldest'} onPress={() => setOrder('oldest')} />
        </View>
        {ordered.map(item => <HistoryRow key={item.id} experiment={item} token={token} offline={offline} cache={cache} onExpired={onExpired} onOpen={onOpen} />)}
      </View>}
  </View>;
}

export function DemoScreen({ token, offline, onExpired, onOpen }: { token: string; offline: boolean; onExpired: () => void; onOpen: (report: LabReport) => void }) { const local = useLocal(); const ui = useStyles();
  const heading = useStepFocus('demo');
  return <View style={local.page}>
    <View style={ui.stack}>
      <Title textRef={heading}>Explore a sample experiment.</Title>
      <Copy style={[ui.muted, NATIVE_TYPOGRAPHY.lead]}>See how a completed experiment becomes a Lab Report. The demo uses labelled sample data.</Copy>
    </View>
    <DemoEntry token={token} offline={offline} onExpired={onExpired} onOpen={onOpen} />
  </View>;
}

type RowState = { kind: 'loading' } | { kind: 'ready'; report: LabReport | null } | { kind: 'error'; message: string };

function HistoryRow({ experiment, token, offline, cache, onExpired, onOpen }: {
  experiment: Experiment; token: string; offline: boolean; cache: HistoryCache; onExpired: () => void; onOpen: (id: string, cached?: LabReport) => void;
}) { const COLORS = useColors(); const local = useLocal(); const ui = useStyles();
  const stored = cache.value?.reports[experiment.id];
  const [state, setState] = useState<RowState>(stored !== undefined ? { kind: 'ready', report: stored } : { kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (offline) return;
    let active = true;
    getReport(token, experiment.id).then(report => {
      if (!active) return;
      if (cache.value) cache.value.reports[experiment.id] = report;
      setState({ kind: 'ready', report });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (expired(cause)) onExpired();
      else setState({ kind: 'error', message: cause instanceof Error ? cause.message : "Couldn't load this. Try again." });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.id, offline, attempt]);

  const report = state.kind === 'ready' ? state.report : null;
  const primary = report?.analysis.metrics.find(metric => metric.key === report.analysis.primary_metric);
  const forecastLabel = experiment.metrics.find(metric => metric.key === experiment.prediction.target_metric)?.label ?? experiment.prediction.target_metric;
  const finished = experiment.completed_at ? new Date(experiment.completed_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const low = reportPercent(experiment.prediction.expected_change_min).replace(/%$/, '');
  const high = reportPercent(experiment.prediction.expected_change_max).replace(/^\+/, '');
  return <View testID="history-row" style={ui.divider}>
    <Copy style={local.count}>{finished ? `Finished ${finished}` : 'Completed experiment'}</Copy>
    {experiment.is_seeded && <Copy style={local.sample}>Sample experiment</Copy>}
    <Copy accessibilityRole="header" style={ui.sectionTitle}>{experiment.question}</Copy>
    <View style={local.fact}>
      <Copy style={ui.muted}>{`Prediction · ${forecastLabel}`}</Copy>
      <Copy style={[ui.number, { color: COLORS.night }]}>{`${low}–${high}`}</Copy>
    </View>
    {state.kind === 'loading' && <Status style={ui.muted}>Loading report…</Status>}
    {state.kind === 'error' && <View style={ui.stack}>
      <Alert>Couldn&apos;t load this report.</Alert>
      <Copy style={ui.muted}>{state.message}</Copy>
      <Action label="Try again" name={`Try again for ${experiment.question}`} secondary disabled={offline} onPress={() => { setState({ kind: 'loading' }); setAttempt(n => n + 1); }} />
    </View>}
    {state.kind === 'ready' && !report && <Copy style={ui.muted}>Report not available yet.</Copy>}
    {report && <>
      <View style={local.fact}>
        <Copy style={ui.muted}>{`Observed · ${primary?.label ?? forecastLabel}`}</Copy>
        <Copy style={[ui.number, { color: COLORS.ink }]}>{primary?.percent_change === null || primary?.percent_change === undefined ? 'Not enough data' : reportPercent(primary.percent_change)}</Copy>
      </View>
      <View style={local.fact}>
        <Copy style={ui.muted}>Signal</Copy>
        <Copy>{SIGNAL_COPY[report.analysis.signal.classification].label}</Copy>
      </View>
    </>}
    <Action label="Open Lab Report" name={`Open Lab Report for ${experiment.question}`} secondary disabled={offline && !report}
      onPress={() => onOpen(experiment.id, offline && report ? report : undefined)} />
  </View>;
}

/** A write, so it only happens on a tap. Resets just the completed sample; no AI call, no active experiment touched. */
function DemoEntry({ token, offline, onExpired, onOpen }: { token: string; offline: boolean; onExpired: () => void; onOpen: (report: LabReport) => void }) { const local = useLocal(); const ui = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function open() {
    if (inFlight.current || offline) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try { onOpen(await resetDemo(token)); }
    catch (cause) {
      if (expired(cause)) onExpired();
      else setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <View style={local.empty}>
    <Copy accessibilityRole="header" style={ui.sectionTitle}>See a completed example</Copy>
    <Copy style={ui.muted}>A sample experiment and its Lab Report, built from invented check-ins. It&apos;s never added to your own results and makes no AI calls. Opening it again resets the sample.</Copy>
    {error ? <>
      <Alert>{`Couldn't prepare the demo: ${error}`}</Alert>
      <Action label="Try again" secondary disabled={busy || offline} onPress={() => void open()} />
    </> : <Action label={busy ? 'Preparing the demo…' : 'Explore a completed example'} secondary disabled={busy || offline} onPress={() => void open()} />}
  </View>;
}

const useLocal = themedStyles((COLORS, mode) => { const ui = useStyles.forMode(mode); return StyleSheet.create({
  page: { gap: SPACING.xl },
  eyebrow: { ...ui.number, ...NATIVE_TYPOGRAPHY.caption },
  empty: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADII.card, borderWidth: LAYOUT.focusWidth / 2, borderColor: COLORS.line, backgroundColor: COLORS.paper },
  count: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  sort: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  sample: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.night },
  fact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm },
}); });
