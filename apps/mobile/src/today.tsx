import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, StyleSheet, View } from 'react-native';
import { COLORS, LAYOUT, MOTION_DURATION_MS, NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import { SampleControls } from './sample-controls';
import { BaselineContext } from './baseline-context';
import { ExperimentDetail } from './experiment-detail';
import { Observations } from './progress';
import { TodayCard } from './today-card';
import { ReminderNotice, Settings } from './settings';
import { useReminders } from './reminder-context';
import { CheckinForm } from './checkin';
import type { Section } from './app-header';
import { DemoScreen, HistoryScreen, type HistoryCache } from './history';
import { LabReportScreen } from './lab-report';
import { ProposalFlow } from './proposal';
import type { Experiment, ExperimentTimeline, LabReport, Profile } from '@rhythm-health/contract';
import { Action, Alert, BackLink, Copy, ForwardLink, Loading, styles, Title, Status } from './ui';
import { ApiError } from './lib/api';
import { getProgress, listActiveExperiments } from './lib/experiments';

const hidden = { display: 'none' } as const;
export type DayData = { experiment: Experiment; timeline: ExperimentTimeline };
export function Today({ token, offline, profile, onExpired, section, navigation, onSection, editProfile }: {
  token: string; offline: boolean; profile: Profile; onExpired: () => void; section: Section; navigation: number; onSection: (next: Section) => void; editProfile?: () => void;
}) {
  const { service: reminders, state: reminderState } = useReminders();
  const [detail, setDetail] = useState(false);
  const [askKey, setAskKey] = useState(0);
  const [loaded, setLoaded] = useState<{ value: DayData | null; at: Date } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const [editing, setEditing] = useState<DayData | null>(null);
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [report, setReport] = useState<{ id: string; initial?: LabReport } | null>(null);
  const [historyCache] = useState<HistoryCache>({ value: null });
  const load = useCallback(async () => {
    if (offline) return;
    const request = ++generation.current;
    setBusy(true); setError(null);
    try {
      const [experiment] = await listActiveExperiments(token);
      const value = experiment ? { experiment, timeline: await getProgress(token, experiment.id) } : null;
      if (request === generation.current) {
        setLoaded({ value, at: new Date() });
        void reminders.refresh(value);
        const intent = reminders.getSnapshot().intent;
        if (intent) {
          reminders.consume();
          if (!value?.experiment.is_seeded && intent.owner === reminders.getSnapshot().owner && value?.experiment.id === intent.experiment && value.timeline.progress.state === 'in_progress') { onSection('lab'); setReport(null); setDetail(false); setEditing(value); }
        }
      }
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load your day. Try again.");
    } finally { if (request === generation.current) setBusy(false); }
  }, [token, offline, onExpired, onSection, reminders]);
  useEffect(() => {
    let active = true;
    const requests = generation;
    queueMicrotask(() => { if (active) void load(); });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active = false; requests.current++; listener.remove(); };
  }, [load]);

  const intent = reminderState.intent;
  useEffect(() => { if (intent && !offline) { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; } }, [intent, offline, load]);

  // Choosing a section in the header leaves open screens. An open proposal stays mounted (below): it was paid for.
  const [seenNavigation, setSeenNavigation] = useState(navigation);
  if (seenNavigation !== navigation) { setSeenNavigation(navigation); setEditing(null); setReport(null); setDetail(false); }

  const disabled = offline || busy || error !== null;
  const data = loaded?.value;
  const sampleControls = <SampleControls key={data?.experiment.id ?? 'empty'} experiment={data?.experiment} token={token} disabled={disabled}
    onExpired={onExpired} onChanged={async () => { setLoaded(null); setSaved(false); await load(); }} />;
  const toLab = () => { onSection('lab'); void load(); };
  const openDemo = (result: LabReport) => setReport({ id: result.experiment.id, initial: result });
  // With nothing running the question is the lab itself, as on the web.
  const inline = Boolean(loaded) && !data && asking === null;
  const flowOpen = asking !== null || inline;
  const flowShown = flowOpen && section === 'lab' && !editing && !report && !detail;
  const flow = flowOpen && <View style={flowShown ? undefined : hidden}>
    <ProposalFlow key={askKey} token={token} offline={offline} profile={profile} initialQuestion={asking ?? ''} knownActive={Boolean(data)} onExpired={onExpired} onEditProfile={editProfile}
      onBack={inline ? undefined : () => { setAsking(null); void load(); }}
      onStarted={() => { setAsking(null); setLoaded(null); setStarted(true); setSaved(false); void load(); }} />
  </View>;
  /** A suggested question replaces whatever was open; an empty ask keeps a plan already on screen. */
  const ask = (question: string) => {
    setReport(null); setDetail(false); onSection('lab'); setStarted(false);
    if (question) { setAskKey(key => key + 1); setAsking(question); }
    else if (data) setAsking('');
  };
  const finished = (result: LabReport) => {
    if (!data) return;
    void reminders.refresh(null); setSaved(false); setStarted(false); setDetail(false);
    setReport({ id: data.experiment.id, initial: result }); setLoaded(null); void load();
  };
  const checkin = () => { if (data) { setSaved(false); setStarted(false); setEditing(data); } };
  const content = () => {
    if (editing) return <CheckinForm key={`${editing.experiment.id}:${editing.timeline.progress.day_number}`} data={editing} token={token} offline={offline} onExpired={onExpired}
      onBack={() => { setEditing(null); void load(); }}
      onSaved={() => { setEditing(null); setSaved(true); void load(); }} />;
    if (report) return <LabReportScreen key={report.id} id={report.id} initial={report.initial} token={token} offline={offline} onExpired={onExpired}
      backTo={section === 'history' ? 'History' : section === 'demo' ? 'Demo' : 'Your lab'}
      onBack={() => { setReport(null); void load(); }}
      onToday={() => { setReport(null); toLab(); }}
      onAsk={ask} />;
    if (section === 'reminders') return <View style={styles.stack}><BackLink to="Your lab" onPress={toLab} /><ReminderNotice feedbackOnly /><Settings /></View>;
    if (section === 'demo') return <DemoScreen token={token} offline={offline} onExpired={onExpired} onOpen={openDemo} onBack={toLab} />;
    if (section === 'history') return <View style={styles.stack}><ReminderNotice feedbackOnly />
      <HistoryScreen token={token} offline={offline} cache={historyCache} onExpired={onExpired} onBack={toLab}
        onOpen={(id, initial) => setReport({ id, initial })}
        onAsk={() => ask('')} />
    </View>;
    if (detail && data) return <ExperimentDetail data={data} token={token} offline={offline} disabled={disabled} onExpired={onExpired}
      onBack={() => { setDetail(false); void load(); }} onCheckin={checkin} onOpenReport={() => setReport({ id: data.experiment.id })} onCompleted={finished} />;
    return lab;
  };
  const lab = (
    <View style={styles.stack}>
      <ReminderNotice />
      {saved && <SavedReceipt failed={error !== null} />}
      {started && <Status>Your experiment has started.</Status>}
      {offline && <Status style={styles.muted}>{loaded
        ? `Offline, last updated ${loaded.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
        : 'No connection'}</Status>}
      {!offline && error && <><Alert>{error}</Alert><Action label="Try again" onPress={() => void load()} /></>}
      {!loaded ? (!offline && busy ? <Loading message="Loading your day…" /> : offline ? <Copy>Reconnect to load today&apos;s experiment.</Copy> : null)
        : !data ? sampleControls : <>
          {sampleControls}
          <ActiveLab data={data} onAsk={() => ask('')} onDetail={() => setDetail(true)} />
          <TodayCard data={data} disabled={disabled} onCheckin={checkin} onOpenReport={() => setReport({ id: data.experiment.id })} />
          <Observations data={data} title="Your observations, day by day." token={token} offline={offline} onExpired={onExpired} />
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </>}
    </View>
  );
  return <View style={styles.stack}>{!(flowShown && asking !== null) && content()}{flow}</View>;
}

function ActiveLab({ data: { experiment, timeline }, onAsk, onDetail }: { data: DayData; onAsk: () => void; onDetail: () => void }) {
  const { progress } = timeline;
  const baseline = progress.phase === 'baseline';
  return <>
    <Copy style={styles.number}>{progress.state === 'in_progress' ? `Day ${progress.day_number} of ${progress.total_days}`
      : progress.state === 'ended' ? 'Experiment days ended' : progress.state === 'completed' ? 'Completed' : 'Not started'}</Copy>
    <Action label="Test another habit" onPress={onAsk} />
    <Title>{experiment.question}</Title>
    <BaselineContext timeline={timeline} />
    <View style={labStyles.change}>
      <Copy style={styles.muted}>{baseline ? 'Keep your usual routine' : 'Your small change'}</Copy>
      <Copy style={labStyles.action}>{experiment.intervention.action}</Copy>
      <Copy style={styles.muted}>{baseline ? `Your change starts on day ${experiment.baseline_days + 1}.` : `${experiment.intervention.timing} · ${experiment.intervention.frequency}`}</Copy>
    </View>
    <ForwardLink label={progress.state === 'ended' && !experiment.is_seeded ? 'Finish and see results' : 'See your experiment'} onPress={onDetail} />
  </>;
}
const labStyles = StyleSheet.create({
  change: { gap: SPACING.xs, borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.moss, paddingLeft: SPACING.md },
  action: { ...NATIVE_TYPOGRAPHY.lead },
});

function SavedReceipt({ failed }: { failed: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const animate = (reduced: boolean) => {
      animation?.stop(); opacity.setValue(1);
      if (active && !reduced) {
        opacity.setValue(0);
        animation = Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION_MS.response, useNativeDriver: true });
        animation.start();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(animate).catch(() => { opacity.setValue(1); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', animate);
    return () => { active = false; animation?.stop(); listener.remove(); };
  }, [opacity]);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
    <Animated.View accessible={false} style={{ opacity }}><Copy>✓</Copy></Animated.View>
    <Status>{failed ? 'Your check-in was saved. Refresh Today to see your progress.' : 'Check-in saved.'}</Status>
  </View>;
}
