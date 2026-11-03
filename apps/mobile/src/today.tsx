import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, View } from 'react-native';
import { MOTION_DURATION_MS, SPACING } from '@rhythm-health/brand';
import { SampleControls } from './sample-controls';
import { BaselineContext } from './baseline-context';
import { Progress } from './progress';
import { ReminderNotice, Settings } from './settings';
import { useReminders } from './reminder-context';
import { CheckinForm } from './checkin';
import { FinishCard } from './finish';
import { DemoEntry, HistoryScreen, type HistoryCache } from './history';
import { LabReportScreen } from './lab-report';
import { ProposalFlow } from './proposal';
import type { Experiment, ExperimentTimeline, LabReport, Profile } from '@rhythm-health/contract';
import { Action, Alert, Copy, Loading, styles, Title, Status } from './ui';
import { ApiError } from './lib/api';
import { getProgress, listActiveExperiments } from './lib/experiments';

export type DayData = { experiment: Experiment; timeline: ExperimentTimeline };
export function Today({ token, offline, profile, onExpired, email, signOut, editProfile }: {
  token: string; offline: boolean; profile: Profile; onExpired: () => void; email?: string; signOut: () => void; editProfile?: () => void;
}) {
  const { service: reminders, state: reminderState } = useReminders();
  const [screen, setScreen] = useState<'today' | 'settings' | 'progress' | 'history'>('today');
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
          if (!value?.experiment.is_seeded && intent.owner === reminders.getSnapshot().owner && value?.experiment.id === intent.experiment && value.timeline.progress.state === 'in_progress') { setScreen('today'); setEditing(value); }
        }
      }
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(cause instanceof Error ? cause.message : "Couldn't load your day. Try again.");
    } finally { if (request === generation.current) setBusy(false); }
  }, [token, offline, onExpired, reminders]);
  useEffect(() => {
    let active = true;
    const requests = generation;
    queueMicrotask(() => { if (active) void load(); });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active = false; requests.current++; listener.remove(); };
  }, [load]);

  const intent = reminderState.intent;
  useEffect(() => { if (intent && !offline) { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; } }, [intent, offline, load]);

  const disabled = offline || busy || error !== null;
  const data = loaded?.value;
  const sampleControls = <SampleControls key={data?.experiment.id ?? 'empty'} experiment={data?.experiment} token={token} disabled={disabled}
    onExpired={onExpired} onChanged={async () => { setLoaded(null); setSaved(false); await load(); }} />;
  const nav = <View style={styles.stack}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}><Action label="Today" secondary={screen !== 'today'} selected={screen === 'today'} onPress={() => { setEditing(null); setScreen('today'); }} /><Action label="Progress" secondary={screen !== 'progress'} selected={screen === 'progress'} onPress={() => { setEditing(null); setScreen('progress'); }} /><Action label="History" secondary={screen !== 'history'} selected={screen === 'history'} onPress={() => { setEditing(null); setScreen('history'); }} /><Action label="Settings" secondary={screen !== 'settings'} selected={screen === 'settings'} onPress={() => { setEditing(null); setScreen('settings'); }} /></View></View>;
  if (screen === 'settings') return <View style={styles.stack}>{nav}<ReminderNotice feedbackOnly /><Settings email={email} signOut={signOut} editProfile={editProfile} /></View>;
  if (editing) return <CheckinForm key={`${editing.experiment.id}:${editing.timeline.progress.day_number}`} data={editing} token={token} offline={offline} onExpired={onExpired}
    onBack={() => { setEditing(null); void load(); }}
    onSaved={() => { setEditing(null); setSaved(true); void load(); }} />;
  if (asking !== null) return <ProposalFlow token={token} offline={offline} profile={profile} initialQuestion={asking} onExpired={onExpired} onEditProfile={editProfile}
    onBack={() => { setAsking(null); void load(); }}
    onStarted={() => { setAsking(null); setLoaded(null); setStarted(true); setSaved(false); void load(); }} />;
  if (report) return <LabReportScreen key={report.id} id={report.id} initial={report.initial} token={token} offline={offline} onExpired={onExpired} backLabel={screen === 'history' ? 'Back to history' : 'Back to Today'}
    onBack={() => { setReport(null); void load(); }}
    onToday={() => { setReport(null); setScreen('today'); void load(); }}
    onAsk={question => { setReport(null); setScreen('today'); setStarted(false); setAsking(question); }} />;
  if (screen === 'history') return <View style={styles.stack}>{nav}<ReminderNotice feedbackOnly />
    <HistoryScreen token={token} offline={offline} cache={historyCache} onExpired={onExpired}
      onOpen={(id, initial) => setReport({ id, initial })}
      onAsk={() => { setScreen('today'); setStarted(false); setAsking(''); }}
      onDemo={result => setReport({ id: result.experiment.id, initial: result })} />
  </View>;
  if (screen === 'progress' && data) return <View style={styles.stack}>{nav}<ReminderNotice feedbackOnly />
    {error && <><Alert>{error}</Alert><Action label="Try again" disabled={offline || busy} onPress={() => void load()} /></>}
    <Progress key={data.experiment.id} data={data} token={token} offline={offline} onExpired={onExpired} />
  </View>;
  return (
    <View style={styles.stack}>
      {nav}
      <ReminderNotice />
      {saved && <SavedReceipt failed={error !== null} />}
      {started && <Status>Your experiment has started.</Status>}
      {offline && <Status style={styles.muted}>{loaded
        ? `Offline, last updated ${loaded.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
        : 'No connection'}</Status>}
      {!offline && error && <><Alert>{error}</Alert><Action label="Try again" onPress={() => void load()} /></>}
      {!loaded ? (!offline && busy ? <Loading message="Loading your day…" /> : offline ? <Copy>Reconnect to load today&apos;s experiment.</Copy> : null)
        : !data ? <>
          <Title>Nothing running yet.</Title>
          <Copy style={styles.muted}>Turn a question about your habits into a short experiment. First a plan, then a prediction. You decide whether to begin.</Copy>
          <Action label="Ask a question" onPress={() => { setStarted(false); setAsking(''); }} />
          {sampleControls}
          <DemoEntry token={token} offline={offline} onExpired={onExpired} onOpen={result => setReport({ id: result.experiment.id, initial: result })} />
        </> : <>
          {sampleControls}
          <TodaySummary data={data} disabled={disabled}
            onCheckin={() => { setSaved(false); setStarted(false); setEditing(data); }}
            onOpenReport={() => setReport({ id: data.experiment.id })} />
          <FinishCard key={`finish:${data.experiment.id}`} experiment={data.experiment} timeline={data.timeline} token={token} offline={offline} onExpired={onExpired}
            onCompleted={result => { void reminders.refresh(null); setSaved(false); setStarted(false); setReport({ id: data.experiment.id, initial: result }); setLoaded(null); void load(); }} />
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </>}
    </View>
  );
}

export function TodaySummary({ data: { experiment, timeline }, disabled, onCheckin, onOpenReport }: {
  data: DayData; disabled: boolean; onCheckin: () => void; onOpenReport: () => void;
}) {
  const { progress } = timeline;
  const current = timeline.days.find(day => day.day_number === progress.day_number);
  const next = timeline.days.find(day => progress.day_number !== null && day.day_number > progress.day_number);
  return <>
    <Copy style={styles.muted}>{experiment.is_seeded ? 'Sample daily loop' : 'Your lab'}</Copy>
    {progress.state === 'in_progress' && <Copy style={styles.number}>Day {progress.day_number} of {progress.total_days}</Copy>}
    <Title>{experiment.question}</Title>
    <BaselineContext timeline={timeline} />
    <View style={styles.divider}>
      {progress.state === 'in_progress' && <Copy>{current?.phase === 'baseline' ? 'Baseline' : 'Test'} day {progress.phase_day} of {progress.phase_days}</Copy>}
      <Copy style={styles.muted}>{current?.phase === 'baseline' ? 'Keep your usual routine' : 'Your small change'}</Copy>
      <Copy>{experiment.intervention.action}</Copy>
      <Copy style={styles.muted}>{experiment.intervention.timing} · {experiment.intervention.frequency}</Copy>
    </View>
    {progress.state === 'in_progress' ? current?.state === 'recorded' ? <View style={styles.decision}>
      <Copy accessibilityRole="header" style={styles.sectionTitle}>Done for today</Copy>
      {timeline.next_day_at && next ? <Copy>Day {next.day_number} opens {new Date(timeline.next_day_at).toLocaleString(undefined, {
        weekday: 'long', hour: 'numeric', minute: '2-digit',
      })}.</Copy> : <Copy>That was the last day. Finish when you&apos;re ready.</Copy>}
      <Action label="Change today's answers" secondary onPress={onCheckin} disabled={disabled} />
    </View> : <Action label={`Check in for day ${progress.day_number}`} onPress={onCheckin} disabled={disabled} />
      : experiment.is_seeded ? <Copy>This sample has ended. Remove it to free the slot for a real experiment.</Copy> : progress.state === 'completed' ? <>
        <Copy accessibilityRole="header" style={styles.sectionTitle}>Your results are ready.</Copy>
        <Action label="See your Lab Report" onPress={onOpenReport} />
      </> : progress.state === 'ended' ? <Copy>Your experiment days are over.</Copy>
      : <Copy>This experiment hasn&apos;t started.</Copy>}
  </>;
}

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
