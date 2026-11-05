"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ActiveCapacity, Profile, TodayCheckin } from "@rhythm-health/contract";
import { ExperimentFlow } from "@/components/experiments/experiment-flow";
import { BaselineContext } from "@/components/experiments/baseline-context";
import { downloadReminder } from "@/components/experiments/experiment-progress";
import { SampleControls } from "@/components/experiments/sample-controls";
import { closeButton, CloseIcon } from "@/components/nav/close-icon";
import { button } from "@/components/ui/button";
import { DayStrip, TodayScene, WeeklyRing } from "./visuals";
import { lastDayRecorded, closesAt, dayLabel, displayTime, experimentName, experimentPath, orderExperiments, readyForResults, recordedToday, type RunningExperiment } from "./model";

const link = "inline-flex min-h-11 items-center gap-2 font-medium text-moss underline-offset-4 hover:underline";
const panel = "rounded-card border border-line bg-paper";

export function TodayDashboard({ entries, profile, capacity, today, onChanged }: {
  entries: RunningExperiment[]; profile: Profile; capacity?: ActiveCapacity; today?: TodayCheckin; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour] = useState(() => new Date().getHours());
  const panelId = useId();
  const question = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const sorted = orderExperiments(entries);
  const [hero, ...others] = sorted;
  const sample = entries.find(item => item.experiment.is_seeded)?.experiment;
  const canStart = capacity?.can_start ?? true;
  useEffect(() => { if (open) question.current?.querySelector("textarea")?.focus(); }, [open]);
  if (!hero) return null;
  const greeting = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
  return <>
    {sample && <SampleControls experiment={sample} onChanged={onChanged} />}
    <div className="mb-7 flex flex-wrap items-start justify-between gap-5 sm:mb-9">
      <div hidden={open}>
        <h1 className="font-display text-display-sm tracking-tight">Good {greeting}.</h1>
        <p className="mt-2 text-lead">A small check-in. A clearer picture of your day.</p>
      </div>
      {canStart && <button ref={toggle} type="button" aria-expanded={open} aria-controls={panelId}
        aria-label={open ? "Close question" : undefined} className={open ? `${closeButton} ml-auto` : button("secondary")}
        onClick={() => { if (open) toggle.current?.focus(); setOpen(!open); }}>
        {open ? <CloseIcon /> : "Test another habit"}
      </button>}
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <div id={panelId} ref={question} hidden={!open}>
          {canStart && <ExperimentFlow profile={profile} returnTo="/" showStarters={false} onReloadLab={onChanged} />}
        </div>
        <section aria-label="Your next action" className={`${panel} overflow-hidden`}>
          <div hidden={open}>
            <div className="grid sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="p-5 sm:p-7">
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption">
                <span className="rounded-pill bg-moss-tint px-3 py-1 font-medium">{recordedToday(hero) ? "Done for today" : hero.experiment.is_seeded ? "Example experiment" : readyForResults(hero) ? "Ready to reflect" : "Today's experiment"}</span>
                <span className="font-mono tabular-nums">{dayLabel(hero)}</span>
                {hero.timeline.progress.phase && <span>{hero.timeline.progress.phase === "baseline" ? "Normal" : "Test"}</span>}
              </div>
              <h2 className="font-display text-headline tracking-tight sm:text-display-sm">{experimentName(hero)}</h2>
              <p className="mt-3 text-lead">{hero.timeline.progress.phase === "baseline" ? "Keep your usual routine today." : hero.experiment.intervention.change_short || "Make your small change, then record how it went."}</p>
              <details className="group mt-3">
                <summary className={`${link} cursor-pointer w-fit`}><span>Details</span> <span aria-hidden="true" className="transition-transform duration-[var(--motion-press)] group-open:rotate-180 motion-reduce:transition-none">⌄</span></summary>
                <div className="space-y-3 border-t border-line py-4">
                  <p>{hero.experiment.question}</p>
                  <p>{hero.experiment.intervention.action}</p>
                  <p>{hero.experiment.intervention.timing} · {hero.experiment.intervention.frequency}</p>
                  <Link href={experimentPath(hero)} className={link}>See your experiment <span aria-hidden="true">→</span></Link>
                </div>
              </details>
            </div>
            <TodayScene entry={hero} />
            </div>
          </div>
          <div className="p-5 sm:p-7"><NextAction entry={hero} today={today} secondary={open} /></div>
          <div hidden={open} className="border-t border-line px-5 py-5 sm:px-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-caption">
              <span>Your {hero.timeline.progress.total_days} days</span>
              <span>{hero.timeline.recorded_days}/{hero.timeline.progress.total_days} recorded</span>
            </div>
            <DayStrip entry={hero} />
            <p className="mt-3 text-caption text-muted">✓ recorded · – missed · outlined today</p>
          </div>
        </section>
        <UpNext entry={hero} />
      </div>
      <aside className="min-w-0 space-y-6">
        <section aria-label="Your rhythm" className={`${panel} p-5 sm:p-6`}>
          <h2 className="font-display text-title">Your rhythm</h2>
          <div className="mt-4 flex items-center gap-5">
            <WeeklyRing entry={hero} />
            <div className="min-w-0">
              <p className="font-medium">{experimentName(hero)}</p>
              <p className="mt-1 text-caption text-muted">{hero.experiment.is_seeded ? "Example · last 7 days" : "Last 7 experiment days"}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5">
            <div><dt className="text-caption">Days recorded</dt><dd className="mt-1 font-mono text-title">{hero.timeline.recorded_days}<span className="text-body">/{hero.timeline.progress.total_days}</span></dd></div>
            <div><dt className="text-caption">Days missed</dt><dd className="mt-1 font-mono text-title">{hero.timeline.missed_days}</dd></div>
          </dl>
          <Link href={experimentPath(hero)} className={`${link} mt-3`}>Explore your observations <span aria-hidden="true">→</span></Link>
        </section>
        {others.length > 0 && <section aria-label="Also running">
          <h2 className="mb-3 font-display text-title">Also running</h2>
          <div className="space-y-3">{others.map(entry => <RunningCard key={entry.experiment.id} entry={entry} />)}</div>
        </section>}
        {!canStart && <p className="text-body">You&apos;re running {capacity?.limit} experiments, the most at once. Finish one to start another.</p>}
      </aside>
    </div>
  </>;
}

function NextAction({ entry, today, secondary }: { entry: RunningExperiment; today?: TodayCheckin; secondary: boolean }) {
  const { progress } = entry.timeline;
  const path = experimentPath(entry);
  const combined = today && today.experiments.length > 1 && !entry.experiment.is_seeded && today.experiments.some(item => item.id === entry.experiment.id);
  const done = combined ? today.all_recorded : recordedToday(entry);
  const action = button(secondary ? "secondary" : "primary");
  if (entry.experiment.is_seeded && readyForResults(entry)) return <>
    <p>This example has ended. Your real experiments stay separate.</p>
    <Link className={`${action} mt-4`} href={path}>See example details</Link>
  </>;
  if (readyForResults(entry)) return <>
    <p className="mb-4">{progress.state === "completed" ? "Your results are ready." : "Your experiment days are done. See what your check-ins show."}</p>
    <Link className={action} href={progress.state === "completed" ? `${path}/report` : path}>{progress.state === "completed" ? "See your Lab Report" : "Finish and see results"}</Link>
    {lastDayRecorded(entry) && progress.state === "in_progress" && <Link className={`${link} mt-3 block`} href={`${path}/check-in`}>Change today&apos;s answers</Link>}
  </>;
  if (progress.state === "not_started" || progress.day_number === null) return <p>This experiment hasn&apos;t started. Nothing to check in yet.</p>;
  const close = closesAt(entry);
  return <>
    {combined && <p className="mb-4">{done ? `All ${today.experiments.length} check-ins are recorded.` : `One check-in for all ${today.experiments.length} experiments.`}</p>}
    <Link className={action} href={combined ? "/check-in" : `${path}/check-in`}>
      {done ? "Change today's answers" : combined ? "Check in for today" : `Check in for day ${progress.day_number}`}
      <span className="ml-3" aria-hidden="true">→</span>
    </Link>
    {!done && <p className="mt-3 text-caption text-muted">About 30 seconds{close ? ` · Closes ${displayTime(close)}` : ""}</p>}
  </>;
}

function UpNext({ entry }: { entry: RunningExperiment }) {
  const { progress, next_day_at: next } = entry.timeline;
  const normal = progress.phase === "baseline";
  const done = recordedToday(entry);
  return <section className="border-t border-line py-2">
    <h2 className="mt-3 font-display text-title">Up next</h2>
    <p className="mt-3">{readyForResults(entry) ? "Compare your guess with what happened, then choose what to try next."
      : progress.state === "not_started" ? "Your first check-in opens when this experiment starts."
      : normal ? `Your small change starts on day ${entry.experiment.baseline_days + 1}. Until then, record your usual days.`
        : done ? "You're done for today. Come back for your next observation." : "Record today before moving on. Each day adds to your picture."}</p>
    {next && progress.days_remaining !== null && progress.days_remaining > 0 && <p className="mt-2 text-caption text-muted">Next day opens {displayTime(next)}</p>}
    {done && next && progress.day_number !== null && (progress.days_remaining ?? 0) > 0 && !entry.experiment.is_seeded && <button type="button"
      className={`${button("secondary")} mt-4`} onClick={() => downloadReminder(entry.experiment, progress.day_number! + 1, new Date(next), `${experimentPath(entry)}/check-in`)}>
      Add day {progress.day_number + 1} to your calendar
    </button>}
    {entry.timeline.baseline_summary && <details className="mt-3 [&_p]:text-ink"><summary className={`${link} cursor-pointer`}>Your normal days</summary><BaselineContext timeline={entry.timeline} /></details>}
  </section>;
}

function RunningCard({ entry }: { entry: RunningExperiment }) {
  const name = experimentName(entry);
  return <article aria-label={name} className={`${panel} p-4 transition-transform duration-[var(--motion-press)] hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 motion-reduce:transition-none`}>
    <Link href={experimentPath(entry)} className="flex min-h-11 items-center justify-between gap-4 rounded-control text-ink">
      <div className="min-w-0"><h3 className="font-medium">{name}</h3><p className="mt-1 text-caption text-muted">{entry.experiment.is_seeded ? "Example · " : ""}{dayLabel(entry)}</p></div>
      <span aria-hidden="true">↗</span>
    </Link>
    <div className="mt-3"><DayStrip entry={entry} /></div>
  </article>;
}
