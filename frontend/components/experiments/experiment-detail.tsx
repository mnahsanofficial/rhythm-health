"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Timeline, TodayCard } from "@/components/experiments/experiment-progress";
import { ForecastCard } from "@/components/experiments/new-experiment";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins } from "@/lib/data/checkins";
import { getExperiment } from "@/lib/data/experiments";
import { completeExperiment, notEnoughCheckins } from "@/lib/data/reports";
import type { Checkin, Experiment } from "@/lib/types/api";

// Mirrors backend/app/services/analysis.py: results need this many check-ins per phase.
const MIN_BASELINE_CHECKINS = 2;
const MIN_TEST_CHECKINS = 3;

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-paper transition-[background-color,opacity,scale] hover:bg-moss-deep active:scale-[0.98] disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill border border-line bg-paper px-5 text-body font-medium text-ink hover:border-moss disabled:opacity-60";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; experiment: Experiment; checkins: Checkin[] }
  | { kind: "error"; status: number; message: string };

function counts(experiment: Experiment, checkins: Checkin[]) {
  const baseline = checkins.filter((c) => c.phase === "baseline").length;
  const test = checkins.length - baseline;
  const needBaseline = Math.min(MIN_BASELINE_CHECKINS, experiment.baseline_days);
  const needTest = Math.min(MIN_TEST_CHECKINS, experiment.intervention_days);
  return {
    baseline,
    test,
    needBaseline,
    needTest,
    changeMade: checkins.filter((c) => c.phase === "intervention" && c.intervention_completed).length,
    canFinish: baseline >= needBaseline && test >= needTest,
  };
}

export function ExperimentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const path = `/experiments/${encodeURIComponent(id)}`;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
      return;
    }
    let cancelled = false;
    Promise.all([getExperiment(id), listCheckins(id)])
      .then(([experiment, checkins]) => !cancelled && setLoad({ kind: "ready", experiment, checkins }))
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
          return;
        }
        setLoad({
          kind: "error",
          status: cause instanceof ApiError ? cause.status : 0,
          message: cause instanceof Error ? cause.message : "Something went wrong.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, path, session, sessionLoading, router, attempt]);

  if (load.kind === "loading") return <ExperimentDetailSkeleton />;

  if (load.kind === "error") {
    const notFound = load.status === 404;
    return (
      <div className="page-frame py-12">
        <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
          <h1 className="font-display text-title">
            {notFound ? "We couldn't find that experiment." : "We couldn't load your experiment."}
          </h1>
          {!notFound && <p className="mt-2">{load.message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {!notFound && (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setLoad({ kind: "loading" });
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </button>
            )}
            <Link href="/" className="inline-flex min-h-11 items-center underline">
              Back to your lab
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { experiment, checkins } = load;
  const { progress } = experiment;
  const c = counts(experiment, checkins);

  return (
    <div className="page-frame pt-8 pb-16 sm:pt-14">
      <Link href="/" className="-mx-1 inline-flex min-h-11 items-center px-1 text-moss hover:underline">
        ← Your lab
      </Link>
      <p className="mt-6 font-mono text-caption text-moss tabular-nums">
        {progress.state === "in_progress"
          ? `Day ${progress.day_number} of ${progress.total_days} · ${progress.phase === "intervention" ? "Test" : "Baseline"} day ${progress.phase_day} of ${progress.phase_days}`
          : progress.state === "completed"
            ? "Completed"
            : progress.state === "ended"
              ? "All days done"
              : "Not started"}
      </p>
      <h1 className="mt-2 max-w-4xl font-display text-headline tracking-tight sm:text-display-sm">{experiment.question}</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <TodayCard experiment={experiment} checkins={checkins} path={path} />
        <FinishCard
          experiment={experiment}
          counts={c}
          onCompleted={() => router.push(`${path}/report`)}
          onDataChanged={() => setAttempt((n) => n + 1)}
        />
      </div>

      <section aria-labelledby="timeline-heading" className="mt-8 rounded-card border border-line bg-paper p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="timeline-heading" className="font-display text-title">
            Your timeline
          </h2>
          <p className="text-caption text-muted tabular-nums">
            {checkins.length} of {progress.total_days} days logged
            {c.test > 0 && ` · change made on ${c.changeMade} of ${c.test} test days`}
          </p>
        </div>
        <Timeline experiment={experiment} checkins={checkins} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-card bg-paper p-6 sm:p-7">
          <p className="font-mono text-caption text-moss">The small change</p>
          <h2 className="mt-2 font-display text-title">{experiment.intervention.action}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted">When</dt>
              <dd>{experiment.intervention.timing}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">How often</dt>
              <dd>{experiment.intervention.frequency}</dd>
            </div>
          </dl>
          <p className="mt-5 text-caption text-muted">
            Baseline days come first: keep your routine as it is. The change starts on day {experiment.baseline_days + 1}.
          </p>
        </section>
        <ForecastCard prediction={experiment.prediction} metrics={experiment.metrics} />
      </div>
    </div>
  );
}

/** Results unlock after a minimum number of check-ins; finishing early is allowed but flagged. */
function FinishCard({
  experiment,
  counts: c,
  onCompleted,
  onDataChanged,
}: {
  experiment: Experiment;
  counts: ReturnType<typeof counts>;
  onCompleted: () => void;
  onDataChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress } = experiment;
  if (experiment.status !== "active") return null;

  const early = progress.state === "in_progress";
  // Days still to come; by the time results unlock, they're all test days.
  const testDaysLeft = early ? (progress.days_remaining ?? 0) : 0;

  if (!c.canFinish) {
    return (
      <section className="rounded-card border border-line bg-paper p-6 sm:p-7">
        <h2 className="font-display text-title">Results unlock soon.</h2>
        <p className="mt-2 text-body text-muted">
          You need at least {c.needBaseline} baseline and {c.needTest} test-day check-ins.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Meter label="Baseline" have={c.baseline} need={c.needBaseline} />
          <Meter label="Test days" have={c.test} need={c.needTest} />
        </dl>
      </section>
    );
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await completeExperiment(experiment.id);
      onCompleted();
    } catch (e) {
      const short = notEnoughCheckins(e);
      if (short) {
        setError(
          `Not enough check-ins yet: ${short.baseline_checkins} of ${short.baseline_required} baseline and ${short.intervention_checkins} of ${short.intervention_required} test days.`,
        );
        onDataChanged();
      } else {
        setError(e instanceof Error ? e.message : "Couldn't finish the experiment.");
      }
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-paper p-6 sm:p-7">
      <h2 className="font-display text-title">{early ? "You can finish early." : "Ready for your results."}</h2>
      <p className="mt-2 text-body text-muted">
        {early
          ? `You have enough check-ins for a result. ${testDaysLeft > 0 ? `Finishing now skips ${testDaysLeft} test ${testDaysLeft === 1 ? "day" : "days"}, so there's less evidence to go on.` : ""}`
          : "Finishing runs the analysis and compares it with the prediction."}
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-card bg-clay-tint p-3 text-body text-clay">
          {error}
        </p>
      )}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className={`${early ? secondaryButton : primaryButton} mt-5`}>
          Finish and see results
        </button>
      ) : (
        <div className="mt-5 rounded-card bg-oat p-4">
          <p className="text-body font-medium text-ink">Finish this experiment now? You can&apos;t add check-ins after.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void finish()} disabled={busy} aria-busy={busy} className={primaryButton}>
              {busy ? "Analysing…" : "Yes, finish"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryButton}>
              Keep going
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Meter({ label, have, need }: { label: string; have: number; need: number }) {
  const shown = Math.min(have, need);
  return (
    <div>
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lead tabular-nums">
        {shown} / {need}
      </dd>
      <div aria-hidden="true" className="mt-2 flex gap-1">
        {Array.from({ length: need }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-pill ${i < shown ? "bg-moss" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

/** Same shape as the page: heading, today and finish cards, timeline. */
export function ExperimentDetailSkeleton() {
  return (
    <div aria-hidden="true" className="page-frame pt-8 sm:pt-14">
      <div className="h-5 w-24 rounded-pill bg-line" />
      <div className="mt-8 h-3 w-48 rounded-pill bg-line" />
      <div className="mt-3 h-10 w-3/4 rounded-pill bg-line" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="h-44 rounded-card bg-moss-tint" />
        <div className="h-44 rounded-card bg-paper" />
      </div>
      <div className="mt-8 h-40 rounded-card bg-paper" />
    </div>
  );
}
