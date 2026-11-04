import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LAYOUT, NATIVE_TYPOGRAPHY, SPACING } from '@rhythm-health/brand';
import { SampleControls } from './sample-controls';
import { BaselineContext } from './baseline-context';
import { ExperimentDetail } from './experiment-detail';
import { FinishFlow } from './finish-flow';
import { ProgressScreen } from './progress-tab';
import { TodayCard } from './today-card';
import { ReminderNotice, Settings } from './settings';
import { useReminders } from './reminder-context';
import { Celebration } from './celebration';
import { CheckinForm } from './checkin';
import { CombinedCheckin } from './combined-checkin';
import { getTodayCheckin } from './lib/checkins';
import type { Section } from './app-header';
import { DemoScreen, HistoryScreen, type HistoryCache } from './history';
import { LabReportScreen } from './lab-report';
import { ProposalFlow } from './proposal';
import { You } from './you';
import type { ActiveCapacity, Experiment, ExperimentTimeline, LabReport, Profile, TodayCheckin } from '@rhythm-health/contract';
import { useNavScreen } from './nav';
import { Action, Alert, Copy, ForwardLink, Loading, useStyles, Title, Status } from './ui';
import { ApiError } from './lib/api';
import { getCapacity, getProgress, isLastBaselineDay, listActiveExperiments, testStartsLine } from './lib/experiments';
import { themedStyles } from './theme-core';

const hidden = { display: 'none' } as const;
export type DayData = { experiment: Experiment; timeline: ExperimentTimeline };
export function Today({ token, offline, profile, onExpired, section, navigation, onSection, editProfile, email = 'your account', onSignOut }: {
  token: string; offline: boolean; profile: Profile; onExpired: () => void; section: Section; navigation: number; onSection: (next: Section) => void; editProfile?: () => void; email?: string; onSignOut?: () => void;
}) { const styles = useStyles();
  const { service: reminders, state: reminderState } = useReminders();
  const [detail, setDetail] = useState(false);
  const [askKey, setAskKey] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ value: DayData[]; capacity: ActiveCapacity | null; today: TodayCheckin | null; at: Date } | null>(null);
  const [combined, setCombined] = useState<TodayCheckin | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const [editing, setEditing] = useState<DayData | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [savedAll, setSavedAll] = useState<TodayCheckin | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [report, setReport] = useState<{ id: string; initial?: LabReport } | null>(null);
  const [finishing, setFinishing] = useState<LabReport | null>(null);
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
  if (seenNavigation !== navigation) { setSeenNavigation(navigation); setEditing(null); setReport(null); setDetail(false); setSavedDay(null); setSavedAll(null); setChosen(null); setCombined(null); setFinishing(null); }

  const disabled = offline || busy || error !== null;
  const entries = loaded?.value ?? [];
  // The screens below act on the one tapped. If it has finished elsewhere they close, rather than switch to another.
  const data = chosen ? entries.find(item => item.experiment.id === chosen) : undefined;
  const sample = entries.find(item => item.experiment.is_seeded) ?? entries[0];
  const sampleControls = <SampleControls key={sample?.experiment.id ?? 'empty'} experiment={sample?.experiment} token={token} disabled={disabled}
    onExpired={onExpired} onChanged={async () => { setLoaded(null); await load(); }} />;
  const toLab = () => { onSection('lab'); void load(); };
  const openDemo = (result: LabReport) => setReport({ id: result.experiment.id, initial: result });
  // With nothing running Today leads with the question, as on the web. The Ask tab shows the same flow, so one paid plan
  // survives moving between them.
  const inline = Boolean(loaded) && entries.length === 0;
  if (section === 'ask' && asking === null) setAsking('');
  const flowOpen = asking !== null || inline;
  const flowShown = flowOpen && (section === 'ask' || (section === 'lab' && inline)) && !combined && !editing && savedDay === null && !report && !detail && !finishing;
  const flow = flowOpen && <View style={flowShown ? undefined : hidden}>
    <ProposalFlow key={askKey} token={token} offline={offline} profile={profile} initialQuestion={asking ?? ''} hideStarters={entries.length > 0} onExpired={onExpired} onEditProfile={editProfile} shown={flowShown} onPlanOpen={setPlanOpen}
      onHome={toLab}
      onStarted={() => { setAsking(null); onSection('lab'); setLoaded(null); setStarted(true); void load(); }} />
  </View>;
  /** A suggested question replaces whatever was open; an empty ask keeps a plan already on screen. */
  const ask = (question: string) => {
    setReport(null); setDetail(false); setFinishing(null); onSection('ask'); setStarted(false);
    if (question) { setAskKey(key => key + 1); setAsking(question); }
  };
  const finished = (entry: DayData, result: LabReport) => {
    void reminders.refresh(entries.filter(item => item !== entry)); setStarted(false); setDetail(false);
    setFinishing(result); setLoaded(null); void load();
  };
  const checkin = (entry: DayData) => { setStarted(false); setChosen(entry.experiment.id); setEditing(entry); };
  const openDetail = (entry: DayData) => { setChosen(entry.experiment.id); setDetail(true); };
  useNavScreen(section !== 'lab' && !combined && !editing && savedDay === null && !report && !finishing ? { kind: 'section', onBack: toLab } : null);
  const content = () => {
    if (combined) return <CombinedCheckin key={combined.revision} initial={combined} token={token} offline={offline} onExpired={onExpired} onBack={() => { setCombined(null); void load(); }}
      onSaved={result => { setCombined(null); setSavedAll(result); void load(); }} />;
    if (editing) return <CheckinForm key={`${editing.experiment.id}:${editing.timeline.progress.day_number}`} data={editing} token={token} offline={offline} onExpired={onExpired}
      onBack={() => { setEditing(null); void load(); }}
      onSaved={() => { setSavedDay(editing.timeline.progress.day_number); setEditing(null); void load(); }} />;
    if (finishing) return <FinishFlow report={finishing} token={token} offline={offline} onExpired={onExpired}
      onSeeReport={() => { setReport({ id: finishing.experiment.id, initial: finishing }); setFinishing(null); }}
      onKeep={() => { setFinishing(null); onSection('progress'); }} onVariation={ask} onNew={() => ask('')} />;
    if (report) return <LabReportScreen key={report.id} id={report.id} initial={report.initial} token={token} offline={offline} onExpired={onExpired}
      backTo={section === 'history' ? 'History' : section === 'demo' ? 'Example' : 'Today'}
      onBack={() => { setReport(null); void load(); }}
      onToday={() => { setReport(null); toLab(); }}
      onAsk={ask} />;
    if (section === 'ask') return null;
    if (section === 'you') return <You email={email} onEditProfile={() => editProfile?.()} onReminders={() => onSection('reminders')} onExample={() => onSection('demo')} onSignOut={() => onSignOut?.()} />;
    if (section === 'progress') return <ProgressScreen entries={loaded ? entries : null} updatedAt={loaded?.at} token={token} offline={offline} onExpired={onExpired} onAsk={() => ask('')} />;
    if (section === 'reminders') return <View style={styles.stack}><ReminderNotice feedbackOnly /><Settings /></View>;
    if (section === 'demo') return <DemoScreen token={token} offline={offline} onExpired={onExpired} onOpen={openDemo} />;
    if (section === 'history') return <View style={styles.stack}><ReminderNotice feedbackOnly />
      <HistoryScreen token={token} offline={offline} cache={historyCache} onExpired={onExpired}
        onOpen={(id, initial) => setReport({ id, initial })}
        onAsk={() => ask('')} />
    </View>;
    if (detail && data) return <ExperimentDetail data={data} token={token} offline={offline} disabled={disabled} onExpired={onExpired}
      onBack={() => { setDetail(false); void load(); }} onCheckin={() => checkin(data)} onOpenReport={() => setReport({ id: data.experiment.id })} onCompleted={result => finished(data, result)} />;
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
        : entries.length === 0 ? (planOpen ? null : sampleControls) : entries.length === 1 ? <>
          {sampleControls}
          <TodayCard data={entries[0]} disabled={disabled} token={token} offline={offline} onExpired={onExpired} onCompleted={result => finished(entries[0], result)} onCheckin={() => checkin(entries[0])} onOpenReport={() => setReport({ id: entries[0].experiment.id })} />
          <ActiveLab data={entries[0]} onDetail={() => openDetail(entries[0])} />
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </> : <>
          {sampleControls}
          <Title>{entries.length} experiments running</Title>
          {!loaded.capacity?.can_start && <Copy>You&apos;re running {loaded.capacity?.limit} experiments, the most at once. Finish one to start another.</Copy>}
          {loaded.today && loaded.today.experiments.length > 1 && <View style={styles.decision}>
            <Copy>{loaded.today.all_recorded ? `Done for today: all ${loaded.today.experiments.length} check-ins are recorded.` : `One check-in for all ${loaded.today.experiments.length} experiments.`}</Copy>
            <Action label={loaded.today.all_recorded ? "Edit answers" : 'Check in for today'} secondary={loaded.today.all_recorded} disabled={disabled} onPress={() => setCombined(loaded.today)} />
          </View>}
          {entries.map(entry => <View key={entry.experiment.id} style={styles.divider}>
            <TodayCard data={entry} disabled={disabled} token={token} offline={offline} onExpired={onExpired} onCompleted={result => finished(entry, result)} onCheckin={() => checkin(entry)} onOpenReport={() => setReport({ id: entry.experiment.id })} />
            <ExperimentSummary data={entry} onDetail={() => openDetail(entry)} />
          </View>)}
          {!offline && busy && <Status style={styles.muted}>Refreshing your day…</Status>}
        </>}
    </View>
  );
  // The flow keeps this one place, hidden or not: moving it would remount it and lose a paid plan.
  const saved = savedDay !== null && data?.timeline ? data.timeline : null;
  const fresh = saved && !busy && error === null ? saved : null;
  return <View style={styles.stack}>{flow}{content()}
    {savedDay !== null && <Celebration {...(saved && data && isLastBaselineDay(saved) && saved.progress.day_number === savedDay ? { title: 'Baseline done.', lines: [testStartsLine(data.experiment.intervention.action)], hold: true } : {})} day={savedDay} totalDays={saved?.progress.total_days ?? null} recordedDays={fresh?.recorded_days ?? null} daysLeft={fresh?.progress.days_remaining ?? null} seeded={Boolean(data?.experiment.is_seeded)} onDone={() => setSavedDay(null)} />}
    {savedAll && savedAll.experiments.length > 0 && <Celebration day={savedAll.experiments[0].day_number} totalDays={savedAll.experiments[0].total_days} recordedDays={null} daysLeft={null}
      seeded={entries.some(entry => entry.experiment.is_seeded && savedAll.experiments.some(item => item.id === entry.experiment.id))}
      title={`${savedAll.experiments.length} check-ins recorded`} lines={savedAll.experiments.map(item => `Day ${item.day_number} of ${item.total_days}`)} onDone={() => setSavedAll(null)} />}
  </View>;
}

function ActiveLab({ data, onDetail }: { data: DayData; onDetail: () => void }) {
  return <>
    <ExperimentSummary data={data} baseline onDetail={onDetail} />
  </>;
}

function ExperimentSummary({ data: { experiment, timeline }, baseline: showBaseline = false, onDetail }: { data: DayData; baseline?: boolean; onDetail: () => void }) { const labStyles = useLabStyles();
  const { progress } = timeline;
  const baseline = progress.phase === 'baseline';
  return <>
    <Title small>{experiment.question}</Title>
    {showBaseline && <BaselineContext timeline={timeline} />}
    <View style={labStyles.change}>
      {baseline ? <>
        <Copy style={labStyles.action}>Keep your usual routine</Copy>
        <Copy style={labStyles.caption}>{`Starts on day ${experiment.baseline_days + 1}: ${experiment.intervention.action}`}</Copy>
      </> : <>
        <Copy style={labStyles.caption}>Your small change</Copy>
        <Copy style={labStyles.action}>{experiment.intervention.action}</Copy>
        <Copy>{`${experiment.intervention.timing} · ${experiment.intervention.frequency}`}</Copy>
      </>}
    </View>
    <ForwardLink label="See your experiment" onPress={onDetail} />
  </>;
}
const useLabStyles = themedStyles(COLORS => StyleSheet.create({
  caption: { ...NATIVE_TYPOGRAPHY.caption, color: COLORS.muted },
  change: { gap: SPACING.xs, borderLeftWidth: LAYOUT.focusWidth, borderColor: COLORS.moss, paddingLeft: SPACING.md },
  action: { ...NATIVE_TYPOGRAPHY.lead },
}));
