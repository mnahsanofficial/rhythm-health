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
import { CheckinForm, CheckinSaved } from './checkin';
import { CombinedCheckin } from './combined-checkin';
import { getTodayCheckin } from './lib/checkins';
import type { Section } from './app-header';
import { DemoScreen, HistoryScreen, type HistoryCache } from './history';
import { LabReportScreen } from './lab-report';
import { ProposalFlow } from './proposal';
import type { ActiveCapacity, Experiment, ExperimentTimeline, LabReport, Profile, TodayCheckin } from '@rhythm-health/contract';
import { Action, Alert, BackLink, Copy, ForwardLink, Loading, styles, Title, Status } from './ui';
import { ApiError } from './lib/api';
import { getCapacity, getProgress, listActiveExperiments } from './lib/experiments';

const hidden = { display: 'none' } as const;
export type DayData = { experiment: Experiment; timeline: ExperimentTimeline };
export function Today({ token, offline, profile, onExpired, section, navigation, onSection, editProfile }: {
  token: string; offline: boolean; profile: Profile; onExpired: () => void; section: Section; navigation: number; onSection: (next: Section) => void; editProfile?: () => void;
}) {
  const { service: reminders, state: reminderState } = useReminders();
  const [detail, setDetail] = useState(false);
  const [askKey, setAskKey] = useState(0);
  const [loaded, setLoaded] = useState<{ value: DayData[]; capacity: ActiveCapacity | null; today: TodayCheckin | null; at: Date } | null>(null);
  const [combined, setCombined] = useState<TodayCheckin | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const [editing, setEditing] = useState<DayData | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [report, setReport] = useState<{ id: string; initial?: LabReport } | null>(null);
  const [historyCache] = useState<HistoryCache>({ value: null });
  const load = useCallback(async () => {
    if (offline) return;
    const request = ++generation.current;
    setBusy(true); setError(null);
    try {
      const running = await listActiveExperiments(token);
      // All or nothing: a failed read shows the error, never a partial list.
      const value = await Promise.all(running.map(async experiment => ({ experiment, timeline: await getProgress(token, experiment.id) })));
      const [capacity, today] = value.length > 1 ? await Promise.all([getCapacity(token), getTodayCheckin(token)]) : [null, null];
      if (request === generation.current) {
        setLoaded({ value, capacity, today, at: new Date() });
        void reminders.refresh(value);
        const intent = reminders.getSnapshot().intent;
        if (intent) {
          reminders.consume();
          const target = value.find(item => item.experiment.id === intent.experiment);
          if (target && !target.experiment.is_seeded && intent.owner === reminders.getSnapshot().owner && target.timeline.progress.state === 'in_progress') { onSection('lab'); setReport(null); setDetail(false); setSavedDay(null); setCombined(null); setChosen(target.experiment.id); setEditing(target); }
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
  if (seenNavigation !== navigation) { setSeenNavigation(navigation); setEditing(null); setReport(null); setDetail(false); setSavedDay(null); setChosen(null); setCombined(null); }

  const disabled = offline || busy || error !== null;
  const entries = loaded?.value ?? [];
  // The screens below act on the one tapped. If it has finished elsewhere they close, rather than switch to another.
  const data = chosen ? entries.find(item => item.experiment.id === chosen) : undefined;
  const sample = entries.find(item => item.experiment.is_seeded) ?? entries[0];
  const sampleControls = <SampleControls key={sample?.experiment.id ?? 'empty'} experiment={sample?.experiment} token={token} disabled={disabled}
    onExpired={onExpired} onChanged={async () => { setLoaded(null); await load(); }} />;
  const toLab = () => { onSection('lab'); void load(); };
  const openDemo = (result: LabReport) => setReport({ id: result.experiment.id, initial: result });
  // With nothing running the question is the lab itself, as on the web.
  const inline = Boolean(loaded) && entries.length === 0 && asking === null;
  const flowOpen = asking !== null || inline;
  const flowShown = flowOpen && section === 'lab' && !combined && !editing && savedDay === null && !report && !detail;
  const flow = flowOpen && <View style={flowShown ? undefined : hidden}>
    <ProposalFlow key={askKey} token={token} offline={offline} profile={profile} initialQuestion={asking ?? ''} hideStarters={entries.length > 0} onExpired={onExpired} onEditProfile={editProfile}
      onBack={inline ? undefined : () => { setAsking(null); void load(); }}
      onStarted={() => { setAsking(null); setLoaded(null); setStarted(true); void load(); }} />
  </View>;
  /** A suggested question replaces whatever was open; an empty ask keeps a plan already on screen. */
  const ask = (question: string) => {
    setReport(null); setDetail(false); onSection('lab'); setStarted(false);
    if (question) { setAskKey(key => key + 1); setAsking(question); }
    else if (entries.length) setAsking('');
  };
  const finished = (result: LabReport) => {
    if (!data) return;
    void reminders.refresh(entries.filter(item => item !== data)); setStarted(false); setDetail(false);
    setReport({ id: data.experiment.id, initial: result }); setLoaded(null); void load();
  };
  const checkin = (entry: DayData) => { setStarted(false); setChosen(entry.experiment.id); setEditing(entry); };
  const openDetail = (entry: DayData) => { setChosen(entry.experiment.id); setDetail(true); };
  const content = () => {
    if (combined) return <CombinedCheckin key={combined.revision} initial={combined} token={token} offline={offline} onExpired={onExpired} onBack={() => { setCombined(null); void load(); }} />;
    if (editing) return <CheckinForm key={`${editing.experiment.id}:${editing.timeline.progress.day_number}`} data={editing} token={token} offline={offline} onExpired={onExpired}
      onBack={() => { setEditing(null); void load(); }}
      onSaved={() => { setSavedDay(editing.timeline.progress.day_number); setEditing(null); void load(); }} />;
    if (savedDay !== null) return <CheckinSaved day={savedDay} data={data} refreshing={busy} failed={error !== null} receipt={<SavedReceipt failed={error !== null} />} reminder={<ReminderNotice />} onRetry={() => void load()}
      onBack={() => { setSavedDay(null); void load(); }} onChange={() => { setSavedDay(null); if (data) setEditing(data); }} />;
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
      onBack={() => { setDetail(false); void load(); }} onCheckin={() => checkin(data)} onOpenReport={() => setReport({ id: data.experiment.id })} onCompleted={finished} />;
    return lab;
  };
  const lab = (
    <View style={styles.stack}>
      <ReminderNotice />
      {started && <Status>Your experiment has started.</Status>}
      {offline && <Status style={styles.muted}>{loaded
        ? `Offline, last updated ${loaded.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
        : 'No connection'}</Status>}
      {!offline && error && <><Alert>{error}</Alert><Action label="Try again" onPress={() => void load()} /></>}
      {!loaded ? (!offline && busy ? <Loading message="Loading your day…" /> : offline ? <Copy>Reconnect to load today&apos;s experiment.</Copy> : null)
        : entries.length === 0 ? sampleControls : entries.length === 1 ? <>
          {sampleControls}
          <ActiveLab data={entries[0]} onAsk={() => ask('')} onDetail={() => openDetail(entries[0])} />
          <TodayCard data={entries[0]} disabled={disabled} onCheckin={() => checkin(entries[0])} onOpenReport={() => setReport({ id: entries[0].experiment.id })} />
          <Observations data={entries[0]} title="Your observations, day by day." token={token} offline={offline} onExpired={onExpired} />
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </> : <>
          {sampleControls}
          <Title>{entries.length} experiments running</Title>
          {loaded.capacity?.can_start
            ? <Action label="Test another habit" inline onPress={() => ask('')} />
            : <Copy style={styles.muted}>You&apos;re running {loaded.capacity?.limit} experiments, the most at once. Finish one to start another.</Copy>}
          {loaded.today && loaded.today.experiments.length > 1 && <View style={styles.decision}>
            <Copy>{loaded.today.all_recorded ? `Done for today: all ${loaded.today.experiments.length} check-ins are recorded.` : `One check-in for all ${loaded.today.experiments.length} experiments.`}</Copy>
            <Action label={loaded.today.all_recorded ? "Change today's answers" : 'Check in for today'} secondary={loaded.today.all_recorded} disabled={disabled} onPress={() => setCombined(loaded.today)} />
          </View>}
          {entries.map(entry => <View key={entry.experiment.id} style={styles.divider}>
            <Copy style={labStyles.day}>{dayLabel(entry.timeline)}</Copy>
            <ExperimentSummary data={entry} onDetail={() => openDetail(entry)} />
            <TodayCard data={entry} disabled={disabled} onCheckin={() => checkin(entry)} onOpenReport={() => setReport({ id: entry.experiment.id })} />
          </View>)}
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </>}
    </View>
  );
  return <View style={styles.stack}>{!(flowShown && asking !== null) && content()}{flow}</View>;
}

function dayLabel({ progress }: ExperimentTimeline) {
  return progress.state === 'in_progress' ? `Day ${progress.day_number} of ${progress.total_days}`
    : progress.state === 'ended' ? 'Experiment days ended' : progress.state === 'completed' ? 'Completed' : 'Not started';
}

function ActiveLab({ data, onAsk, onDetail }: { data: DayData; onAsk: () => void; onDetail: () => void }) {
  return <>
    <View style={labStyles.top}>
      <Copy style={labStyles.day}>{dayLabel(data.timeline)}</Copy>
      <Action label="Test another habit" inline onPress={onAsk} />
    </View>
    <ExperimentSummary data={data} baseline onDetail={onDetail} />
  </>;
}

function ExperimentSummary({ data: { experiment, timeline }, baseline: showBaseline = false, onDetail }: { data: DayData; baseline?: boolean; onDetail: () => void }) {
  const { progress } = timeline;
  const baseline = progress.phase === 'baseline';
  return <>
    <Title small>{experiment.question}</Title>
    {showBaseline && <BaselineContext timeline={timeline} />}
    <View style={labStyles.change}>
      <Copy style={styles.muted}>{baseline ? 'Keep your usual routine' : 'Your small change'}</Copy>
      <Copy style={labStyles.action}>{experiment.intervention.action}</Copy>
      <Copy style={styles.muted}>{baseline ? `Your change starts on day ${experiment.baseline_days + 1}.` : `${experiment.intervention.timing} · ${experiment.intervention.frequency}`}</Copy>
    </View>
    <ForwardLink label={progress.state === 'ended' && !experiment.is_seeded ? 'Finish and see results' : 'See your experiment'} onPress={onDetail} />
  </>;
}
const labStyles = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  day: { ...styles.number, ...NATIVE_TYPOGRAPHY.caption },
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
