"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Timeline, TodayCard } from "@/components/experiments/experiment-progress";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins } from "@/lib/data/checkins";
import { listExperiments } from "@/lib/data/experiments";
import { getProfile } from "@/lib/data/profile";
import type { Checkin, Experiment } from "@/lib/types/api";

type State =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "ready" }
  | { kind: "active"; experiment: Experiment; checkins: Checkin[] }
  | { kind: "error"; message: string };

const primary = "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-paper transition-transform hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none";
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
        const [experiment] = await listExperiments("active");
        if (cancelled) return;
        if (!experiment) {
          setState({ kind: "ready" });
          return;
        }
        const checkins = await listCheckins(experiment.id);
        if (!cancelled) setState({ kind: "active", experiment, checkins });
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
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
      <p className="text-body text-muted">Your lab</p>
      {state.kind === "active" ? (
        <ActiveLab experiment={state.experiment} checkins={state.checkins} />
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
      ) : (
        <section className="max-w-2xl py-10 sm:py-16">
          <h1 className="font-display text-display-sm tracking-tight sm:text-display">
            {state.kind === "new" ? "Start with your rhythm." : "What would you like to learn?"}
          </h1>
          <p className="mt-5 max-w-lg text-lead text-muted">
            {state.kind === "new"
              ? "Tell us about your routine so your first experiment fits your day."
              : "You have no experiment running. Choose one small change to test next."}
          </p>
          <Link href={state.kind === "new" ? "/onboarding" : "/experiments/new"} className={`${primary} mt-8`}>
            {state.kind === "new" ? "Set up your rhythm" : "Test a new question"}
          </Link>
        </section>
      )}
      <nav aria-label="Your lab" className="mt-10 flex flex-wrap gap-x-7 gap-y-1 border-t border-line pt-4">
        <Link href="/history" className={textLink}>Experiment history</Link>
        <Link href="/onboarding" className={textLink}>Update your rhythm</Link>
        <Link href="/demo" className={textLink}>Demo</Link>
      </nav>
    </div>
  );
}

function ActiveLab({ experiment, checkins }: { experiment: Experiment; checkins: Checkin[] }) {
  const { progress } = experiment;
  const path = `/experiments/${encodeURIComponent(experiment.id)}`;
  const logged = new Set(checkins.map((day) => day.day_number)).size;
  const testDays = checkins.filter((day) => day.phase === "intervention");
  const followed = testDays.filter((day) => day.intervention_completed).length;

  return (
    <>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-14">
        <section>
          <p className="font-mono text-caption text-moss tabular-nums">
            {progress.state === "in_progress"
              ? `Day ${progress.day_number} of ${progress.total_days}`
              : progress.state === "ended" ? "Experiment days ended" : progress.state === "completed" ? "Completed" : "Not started"}
          </p>
          <h1 className="mt-3 font-display text-headline tracking-tight text-balance sm:text-display-sm">
            {experiment.question}
          </h1>
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
        </section>
        <TodayCard experiment={experiment} checkins={checkins} path={path} />
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
        <Timeline experiment={experiment} checkins={checkins} />
      </section>
    </>
  );
}

function LabSkeleton() {
  return (
    <div role="status" aria-label="Loading your lab" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
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
