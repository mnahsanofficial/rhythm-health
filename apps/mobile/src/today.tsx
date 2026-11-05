import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { SampleControls } from './sample-controls';
import { TodayDashboard } from './today-dashboard';
import { ExperimentDetail } from './experiment-detail';
import { FinishNow } from './finish';
import { FinishFlow } from './finish-flow';
import { ProgressScreen } from './progress-tab';
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
import { Action, Alert, Copy, Loading, useStyles, Status } from './ui';
import { ApiError } from './lib/api';
import { getCapacity, getProgress, isLastBaselineDay, listActiveExperiments, testStartsLine } from './lib/experiments';

const hidden = { display: 'none' } as const;
export type DayData = { experiment: Experiment; timeline: ExperimentTimeline };
export function Today({ token, offline, profile, onExpired, section, navigation, onSection, editProfile, email = 'your account', onSignOut }: {
  token: string; offline: boolean; profile: Profile; onExpired: () => void; section: Section; navigation: number; onSection: (next: Section) => void; editProfile?: () => void; email?: string; onSignOut?: () => void;
}) { const styles = useStyles();
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
  const sample = data ?? entries.find(item => item.experiment.is_seeded) ?? entries[0];
  const sampleControls = <SampleControls key={sample?.experiment.id ?? 'empty'} experiment={sample?.experiment} token={token} disabled={disabled}
    onExpired={onExpired} onChanged={async () => { setLoaded(null); await load(); }} />;
  const toLab = () => { onSection('lab'); void load(); };
  const openDemo = (result: LabReport) => setReport({ id: result.experiment.id, initial: result });
  // Keep one mounted Ask flow so changing tabs cannot discard a paid plan.
  if (section === 'ask' && asking === null) setAsking('');
  const flowOpen = asking !== null;
  const flowShown = flowOpen && section === 'ask' && !combined && !editing && savedDay === null && !report && !detail && !finishing;
  const flow = flowOpen && <View style={flowShown ? undefined : hidden}>
    <ProposalFlow key={askKey} token={token} offline={offline} profile={profile} initialQuestion={asking ?? ''} hideStarters={entries.length > 0} onExpired={onExpired} onEditProfile={editProfile} shown={flowShown}
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
    if (section === 'demo') return <View style={styles.stack}><DemoScreen token={token} offline={offline} onExpired={onExpired} onOpen={openDemo} />{sampleControls}</View>;
    if (section === 'history') return <View style={styles.stack}><ReminderNotice feedbackOnly />
      <HistoryScreen token={token} offline={offline} cache={historyCache} onExpired={onExpired}
        onOpen={(id, initial) => setReport({ id, initial })}
        onAsk={() => ask('')} />
    </View>;
    if (detail && data) return <View style={styles.stack}>{offline && <Status>Offline, last updated {loaded?.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.</Status>}{sampleControls}<ReminderNotice /><ExperimentDetail data={data} token={token} offline={offline} disabled={disabled} onExpired={onExpired}
      onBack={() => { setDetail(false); void load(); }} onCheckin={() => checkin(data)} onOpenReport={() => setReport({ id: data.experiment.id })} onCompleted={result => finished(data, result)} /></View>;
    return lab;
  };
  const lab = (
    <View style={styles.stack}>
      <ReminderNotice feedbackOnly />
      {started && <Status>Your experiment has started.</Status>}
      {offline && <Status style={styles.muted}>{loaded
        ? `Offline, last updated ${loaded.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
        : 'No connection'}</Status>}
      {!offline && error && <><Alert>{error}</Alert><Action label="Try again" onPress={() => void load()} /></>}
      {!loaded ? (!offline && busy ? <Loading message="Loading your day…" /> : offline ? <Copy>Reconnect to load today&apos;s experiment.</Copy> : null)
        : <TodayDashboard entries={entries} disabled={disabled} onCheckin={entry => {
          if (loaded.today && loaded.today.experiments.length > 1 && !entry.experiment.is_seeded) setCombined(loaded.today);
          else checkin(entry);
        }} onDetail={openDetail} onResults={entry => setReport({ id: entry.experiment.id })} renderResults={entry => entry.timeline.progress.state === 'completed'
          ? <Action haptic wide label="See your results" disabled={disabled} onPress={() => setReport({ id: entry.experiment.id })} />
          : <FinishNow haptic experiment={entry.experiment} token={token} offline={offline} disabled={disabled} onExpired={onExpired} onCompleted={result => finished(entry, result)} />} onAsk={() => ask('')} onExample={() => onSection('demo')} />}

    </View>
  );
  // The flow keeps this one place, hidden or not: moving it would remount it and lose a paid plan.
  const saved = savedDay !== null && data?.timeline ? data.timeline : null;
  const fresh = saved && !busy && error === null ? saved : null;
  return <View style={[styles.stack, (combined || editing) && { flexGrow: 1 }]}>{flow}{content()}
    {savedDay !== null && <Celebration {...(saved && data && isLastBaselineDay(saved) && saved.progress.day_number === savedDay ? { title: 'Baseline done.', lines: [{ id: `${data.experiment.id}:${savedDay}`, text: testStartsLine(data.experiment.intervention.action, saved.next_day_at) }], hold: true } : {})} day={savedDay} totalDays={saved?.progress.total_days ?? null} recordedDays={fresh?.recorded_days ?? null} daysLeft={fresh?.progress.days_remaining ?? null} seeded={Boolean(data?.experiment.is_seeded)} onDone={() => setSavedDay(null)} />}
    {savedAll && savedAll.experiments.length > 0 && <Celebration day={savedAll.experiments[0].day_number} totalDays={savedAll.experiments[0].total_days} recordedDays={null} daysLeft={null}
      seeded={entries.some(entry => entry.experiment.is_seeded && savedAll.experiments.some(item => item.id === entry.experiment.id))}
      title={`${savedAll.experiments.length} check-ins recorded`} lines={savedAll.experiments.map(item => ({ id: `${item.id}:${item.day_number}`, text: `Day ${item.day_number} of ${item.total_days}` }))} onDone={() => setSavedAll(null)} />}
  </View>;
}
