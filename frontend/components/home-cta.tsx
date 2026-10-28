"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile } from "@/lib/data/profile";
import { listExperiments } from "@/lib/data/experiments";
import type { Experiment } from "@/lib/types/api";
import { useSession } from "@/lib/auth/session";

type State =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "returning" }
  | { kind: "active"; experiment: Experiment }
  | { kind: "error"; message: string };

const primary =
  "inline-flex min-h-12 shrink-0 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium whitespace-nowrap text-paper transition-[background-color,scale] hover:bg-moss-deep active:scale-[0.98]";

/** The home page's main action: start onboarding, or carry on with a saved rhythm. */
export function HomeCta() {
  const { session, loading } = useSession();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !session) return;
    let cancelled = false;
    getProfile()
      .then(async (profile) => {
        if (cancelled) return;
        if (!profile) {
          setState({ kind: "new" });
          return;
        }
        const active = await listExperiments("active");
        if (cancelled) return;
        setState(active.length ? { kind: "active", experiment: active[0] } : { kind: "returning" });
      })
      .catch((e: Error) => !cancelled && setState({ kind: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [loading, session, attempt]);

  // Signed out is known without a request.
  const view: State = loading ? { kind: "loading" } : !session ? { kind: "new" } : state;

  if (view.kind === "loading") {
    return <div aria-hidden="true" className="h-12 w-64 animate-pulse rounded-pill bg-line" />;
  }

  if (view.kind === "error") {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-card bg-clay-tint p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-body text-clay">Couldn&apos;t load your rhythm: {view.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="min-h-11 rounded-pill bg-paper px-5 text-body font-medium text-ink"
        >
          Try again
        </button>
      </div>
    );
  }

  if (view.kind === "returning") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Link href="/experiments/new" className={primary}>
          Test a new question
        </Link>
        <Link href="/onboarding" className="text-body font-medium text-moss underline-offset-4 hover:underline">
          Update your rhythm
        </Link>
      </div>
    );
  }

  if (view.kind === "active") {
    const { experiment } = view;
    const day = experiment.progress.day_number ?? experiment.progress.total_days;
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Link href={`/experiments/${encodeURIComponent(experiment.id)}`} className={primary}>
          Day {day} of {experiment.progress.total_days}
        </Link>
        <Link href="/experiments/new" className="text-body font-medium text-moss underline-offset-4 hover:underline">
          Test a new question
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Link href="/onboarding" className={primary}>
        Run your first experiment
      </Link>
      <p className="text-caption text-muted">About a minute to set up. You sign up at the end.</p>
    </div>
  );
}
