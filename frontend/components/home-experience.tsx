"use client";

import { SampleControls } from "@/components/experiments/sample-controls";
import Link from "next/link";
import { BaselineContext } from "@/components/experiments/baseline-context";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ExperimentFlow } from "@/components/experiments/experiment-flow";
import { Timeline, TodayCard } from "@/components/experiments/experiment-progress";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getTodayCheckin, listCheckins } from "@/lib/data/checkins";
import { getActiveCapacity, getExperimentProgress, listExperiments } from "@/lib/data/experiments";
import { getProfile } from "@/lib/data/profile";
import type { ActiveCapacity, Checkin, Experiment, ExperimentTimeline, Profile, TodayCheckin } from "@/lib/types/api";

type State =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "ready"; profile: Profile }
  | { kind: "active"; profile: Profile; experiment: Experiment; timeline: ExperimentTimeline; checkins: Checkin[] }
  | { kind: "several"; profile: Profile; items: RunningExperiment[]; capacity: ActiveCapacity; today: TodayCheckin }
  | { kind: "error"; message: string };

type RunningExperiment = { experiment: Experiment; timeline: ExperimentTimeline };

const primary = "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-on-accent transition-transform hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none";
const textLink = "inline-flex min-h-11 items-center text-body font-medium text-moss underline-offset-4 hover:underline";

/** Resolve auth before showing either the public illustration or private experiment. */
export function HomeExperience({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <LabSkeleton />;
  if (!session) return children;
  // Unmount private state on account changes, including while the next request is pending.
  return <SignedInHome key={session.user.id} />;
}

function SignedInHome() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: "new" });
          return;
        }
        const running = await listExperiments("active");
        if (cancelled) return;
        const [experiment] = running;
        if (!experiment) {
          setState({ kind: "ready", profile });
          return;
        }
        if (running.length > 1) {
          // All or nothing: a failed read shows the error, never a partial list.
          const [capacity, today, timelines] = await Promise.all([
            getActiveCapacity(), getTodayCheckin(), Promise.all(running.map((item) => getExperimentProgress(item.id))),
          ]);
          if (!cancelled) setState({
            kind: "several",
            profile,
            capacity,
            today,
            items: running.map((item, index) => ({
              experiment: { ...item, progress: timelines[index].progress },
              timeline: timelines[index],
            })),
          });
          return;
        }
        const [checkins, timeline] = await Promise.all([
          listCheckins(experiment.id), getExperimentProgress(experiment.id),
        ]);
        if (!cancelled) setState({
          kind: "active",
          profile,
          experiment: { ...experiment, progress: timeline.progress },
          timeline,
          checkins,
        });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/sign-in?next=/");
          return;
        }
        setState({ kind: "error", message: error instanceof Error ? error.message : "Please try again." });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [attempt, router]);

  if (state.kind === "loading") return <LabSkeleton />;

  return (
    <div className="page-frame pt-8 pb-16 sm:pt-14">
      {state.kind === "active" ? (
        <ActiveLab
          onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }}
          profile={state.profile}
          experiment={state.experiment}
          checkins={state.checkins}
          timeline={state.timeline}
        />
      ) : state.kind === "several" ? (
        <SeveralLab
          onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }}
          profile={state.profile}
          items={state.items}
          capacity={state.capacity}
          today={state.today}
        />
      ) : state.kind === "error" ? (
        <section role="alert" className="mt-5 max-w-2xl rounded-card bg-clay-tint p-6 text-clay">
          <h1 className="font-display text-headline">We couldn&apos;t load your lab.</h1>
          <p className="mt-3">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="mt-5 min-h-11 rounded-pill bg-paper px-6 font-medium text-ink"
          >
            Try again
          </button>
        </section>
      ) : state.kind === "ready" ? (
        <><SampleControls onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }} /><ExperimentFlow profile={state.profile} returnTo="/" onReloadLab={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }} /></>
      ) : (
        <section className="max-w-2xl py-10 sm:py-16">
          <h1 className="font-display text-display-sm tracking-tight sm:text-display">
            Start with your rhythm.
          </h1>
          <p className="mt-5 max-w-lg text-lead text-muted">
            Tell us about your routine so your first experiment fits your day.
          </p>
          <Link href="/onboarding" className={`${primary} mt-8`}>
            Set up your rhythm
          </Link>
        </section>
      )}
    </div>
  );
}

/** The question form replaces the summary in place; daily evidence stays visible. */
function ActiveLab({ profile, experiment, timeline, checkins, onChanged }: {
  onChanged: () => void;
  profile: Profile;
  experiment: Experiment;
  timeline: ExperimentTimeline;
  checkins: Checkin[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  function toggleQuestion() {
    if (open) {
      setOpen(false);
      toggle.current?.focus();
    } else {
      setOpen(true);
    }
  }

  useEffect(() => {
    if (open) panel.current?.querySelector("textarea")?.focus();
  }, [open]);

  const { progress } = experiment;
  const path = `/experiments/${encodeURIComponent(experiment.id)}`;
  const logged = timeline.recorded_days;
  const testDays = checkins.filter((day) => day.phase === "intervention");
  const followed = testDays.filter((day) => day.intervention_completed).length;

  return (
    <>
      <SampleControls experiment={experiment} onChanged={onChanged} />
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p hidden={open} className="font-mono text-caption text-moss tabular-nums">
              {dayLabel(progress)}
            </p>
            <button
              ref={toggle}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={toggleQuestion}
              className="ml-auto min-h-12 rounded-pill bg-moss px-6 font-medium text-on-accent transition-transform duration-[var(--motion-press)] hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none"
            >
              {open ? "Close question" : "Test another habit"}
            </button>
          </div>
          <section hidden={open}>
            <h1 className="mt-3 font-display text-headline tracking-tight text-balance sm:text-display-sm">
              {experiment.question}
            </h1>
            <BaselineContext timeline={timeline} />
            <ChangeSummary experiment={experiment} path={path} />
          </section>
          <div ref={panel} id={panelId} hidden={!open}>
            <ExperimentFlow
              profile={profile}
              returnTo="/"
              showStarters={false}
              onReloadLab={onChanged}
            />
          </div>
        </div>
        <TodayCard experiment={experiment} timeline={timeline} path={path} />
      </div>
      <section aria-labelledby="lab-progress" className="mt-10 border-t border-line pt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="lab-progress" className="font-display text-title">Your observations, day by day.</h2>
            <p className="mt-2 font-mono text-body tabular-nums">{logged} of {progress.total_days} days recorded</p>
          </div>
          <div className="text-caption text-muted sm:text-right">
            {progress.state === "in_progress" && (
              <p>{progress.phase === "baseline" ? "Baseline" : "Test"} day {progress.phase_day} of {progress.phase_days} · {progress.days_remaining} days remaining</p>
            )}
            {testDays.length > 0 && <p>Change made on {followed} of {testDays.length} test days</p>}
          </div>
        </div>
        <Timeline experiment={experiment} checkins={checkins} timeline={timeline} />
      </section>
    </>
  );
}

function dayLabel(progress: Experiment["progress"]) {
  return progress.state === "in_progress"
    ? `Day ${progress.day_number} of ${progress.total_days}`
    : progress.state === "ended" ? "Experiment days ended" : progress.state === "completed" ? "Completed" : "Not started";
}

function ChangeSummary({ experiment, path }: { experiment: Experiment; path: string }) {
  const { progress } = experiment;
  return (
    <>
      <div className="mt-6 border-l-2 border-moss pl-4">
        <p className="text-caption text-muted">
          {progress.phase === "baseline" ? "Keep your usual routine" : "Your small change"}
        </p>
        <p className="mt-1 text-lead">{experiment.intervention.action}</p>
        <p className="mt-1 text-body text-muted">
          {progress.phase === "baseline"
            ? `Your change starts on day ${experiment.baseline_days + 1}.`
            : `${experiment.intervention.timing} · ${experiment.intervention.frequency}`}
        </p>
      </div>
      <Link href={path} className={`${textLink} mt-5`}>
        {progress.state === "ended" ? "Finish and see results" : "See your experiment"}
        <span aria-hidden="true" className="ml-2">→</span>
      </Link>
    </>
  );
}

/** Two or three running: one card each. The day-by-day timeline stays on each experiment's page. */
function SeveralLab({ profile, items, capacity, today, onChanged }: {
  onChanged: () => void;
  profile: Profile;
  items: RunningExperiment[];
  capacity: ActiveCapacity;
  today: TodayCheckin;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const sample = items.find((item) => item.experiment.is_seeded)?.experiment;

  useEffect(() => {
    if (open) panel.current?.querySelector("textarea")?.focus();
  }, [open]);

  return (
    <>
      {sample && <SampleControls experiment={sample} onChanged={onChanged} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-headline tracking-tight sm:text-display-sm">{items.length} experiments running</h1>
        {capacity.can_start && (
          <button
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              if (open) toggle.current?.focus();
              setOpen(!open);
            }}
            className="min-h-12 rounded-pill bg-moss px-6 font-medium text-on-accent transition-transform duration-[var(--motion-press)] hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none"
          >
            {open ? "Close question" : "Test another habit"}
          </button>
        )}
      </div>
      {!capacity.can_start && (
        <p className="mt-3 text-body text-muted">
          You&apos;re running {capacity.limit} experiments, the most at once. Finish one to start another.
        </p>
      )}
      {capacity.can_start && (
        <div ref={panel} id={panelId} hidden={!open}>
          <ExperimentFlow profile={profile} returnTo="/" headingLevel={2} showStarters={false} onReloadLab={onChanged} />
        </div>
      )}
      {today.experiments.length > 1 && (
        <section aria-label="Today's check-in" className="mt-6 rounded-card bg-moss-tint p-6">
          {today.all_recorded ? (
            <>
              <p className="text-lead">Done for today: all {today.experiments.length} check-ins are recorded.</p>
              <Link href="/check-in" className={`${textLink} mt-2`}>Change today&apos;s answers</Link>
            </>
          ) : (
            <>
              <p className="text-lead">One check-in for all {today.experiments.length} experiments.</p>
              <Link href="/check-in" className={`${primary} mt-4`}>Check in for today</Link>
            </>
          )}
        </section>
      )}
      <div className="mt-8 divide-y divide-line">
        {items.map(({ experiment, timeline }) => <ExperimentCard key={experiment.id} experiment={experiment} timeline={timeline} />)}
      </div>
    </>
  );
}

function ExperimentCard({ experiment, timeline }: RunningExperiment) {
  const titleId = useId();
  const path = `/experiments/${encodeURIComponent(experiment.id)}`;
  return (
    <article aria-labelledby={titleId} className="grid gap-6 py-8 first:pt-0 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-14">
      <div className="min-w-0">
        <p className="font-mono text-caption text-moss tabular-nums">{dayLabel(experiment.progress)}</p>
        <h2 id={titleId} className="mt-3 font-display text-title text-balance">{experiment.question}</h2>
        <ChangeSummary experiment={experiment} path={path} />
      </div>
      <TodayCard experiment={experiment} timeline={timeline} path={path} />
    </article>
  );
}

function LabSkeleton() {
  return (
    <div role="status" aria-label="Loading your lab" className="page-frame py-12">
      <span className="sr-only">Loading your lab</span>
      <div aria-hidden="true">
        <div className="h-5 w-24 rounded-pill bg-line" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="h-4 w-32 rounded-pill bg-line" />
            <div className="h-12 w-full rounded-pill bg-line" />
            <div className="h-12 w-3/4 rounded-pill bg-line" />
            <div className="h-20 w-2/3 rounded-card bg-paper" />
          </div>
          <div className="h-64 rounded-card bg-moss-tint" />
        </div>
        <div className="mt-10 h-40 rounded-card bg-paper" />
      </div>
    </div>
  );
}
