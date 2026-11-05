"use client";

import { SampleControls } from "@/components/experiments/sample-controls";
import Link from "next/link";
import { TodayDashboard } from "@/components/today/dashboard";
import type { RunningExperiment } from "@/components/today/model";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExperimentFlow } from "@/components/experiments/experiment-flow";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getTodayCheckin } from "@/lib/data/checkins";
import { getActiveCapacity, getExperimentProgress, listExperiments } from "@/lib/data/experiments";
import { getProfile } from "@/lib/data/profile";
import type { ActiveCapacity, Experiment, ExperimentTimeline, Profile, TodayCheckin } from "@/lib/types/api";
import { button } from "@/components/ui/button";

type State =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "ready"; profile: Profile }
  | { kind: "active"; profile: Profile; experiment: Experiment; timeline: ExperimentTimeline }
  | { kind: "several"; profile: Profile; items: RunningExperiment[]; capacity: ActiveCapacity; today: TodayCheckin }
  | { kind: "error"; message: string };


const primary = `${button("primary")} text-lead`;

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
        const timeline = await getExperimentProgress(experiment.id);
        if (!cancelled) setState({
          kind: "active",
          profile,
          experiment: { ...experiment, progress: timeline.progress },
          timeline,
        });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/sign-in?next=/");
          return;
        }
        setState({ kind: "error", message: error instanceof Error ? error.message : "Try again." });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [attempt, router]);

  if (state.kind === "loading") return <LabSkeleton />;

  return (
    <div className="page-frame pt-8 pb-16 sm:pt-14">
      {state.kind === "active" ? (
        <TodayDashboard
          onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }}
          profile={state.profile}
          entries={[{ experiment: state.experiment, timeline: state.timeline }]}
        />
      ) : state.kind === "several" ? (
        <TodayDashboard
          onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }}
          profile={state.profile}
          entries={state.items}
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
        <><SampleControls onChanged={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }} /><ExperimentFlow profile={state.profile} returnTo="/" closable onReloadLab={() => { setState({ kind: "loading" }); setAttempt(n => n + 1); }} /></>
      ) : (
        <section className="max-w-2xl py-10 sm:py-16">
          <h1 className="font-display text-display-sm tracking-tight sm:text-display">
            Start with your rhythm.
          </h1>
          <p className="mt-5 max-w-lg text-lead">
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
