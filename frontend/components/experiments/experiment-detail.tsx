"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getExperiment } from "@/lib/data/experiments";
import type { Experiment } from "@/lib/types/api";
import { ForecastCard } from "@/components/experiments/new-experiment";

const detailSkeleton = (
  <div aria-hidden="true" className="space-y-7 motion-safe:animate-pulse">
    <div className="h-5 w-28 rounded-pill bg-line" />
    <div className="h-20 rounded-card bg-paper" />
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="h-28 rounded-card bg-paper" />
      <div className="h-28 rounded-card bg-paper" />
      <div className="h-28 rounded-card bg-paper" />
    </div>
    <div className="h-28 rounded-card bg-paper" />
    <div className="h-52 rounded-card bg-moss-tint" />
  </div>
);

function phaseLabel(phase: Experiment["progress"]["phase"]) {
  if (phase === "baseline") return "Baseline";
  if (phase === "intervention") return "Test";
  return "Not started";
}

function progressMessage(experiment: Experiment) {
  const { progress } = experiment;
  switch (progress.state) {
    case "not_started":
      return "This experiment is ready when you are.";
    case "in_progress":
      return `Day ${progress.day_number ?? "—"} of ${progress.total_days}`;
    case "ended":
      return `Your ${progress.total_days}-day timeline has ended.`;
    case "completed":
      return "This experiment is complete.";
  }
}

function ExperimentTimeline({ experiment }: { experiment: Experiment }) {
  const { progress } = experiment;
  const doneThrough = progress.state === "completed"
    ? progress.total_days
    : progress.state === "ended"
      ? progress.total_days
      : progress.state === "in_progress"
        ? (progress.day_number ?? 1) - 1
        : 0;
  const today = progress.state === "in_progress" ? progress.day_number : null;

  return (
    <ol aria-label="Experiment day timeline" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: progress.total_days }, (_, index) => {
        const day = index + 1;
        const baseline = day <= experiment.baseline_days;
        const isToday = day === today;
        const isDone = day <= doneThrough;
        const tone = isToday
          ? "bg-moss text-paper ring-2 ring-moss ring-offset-2"
          : isDone
            ? baseline ? "bg-night text-paper" : "bg-moss-deep text-paper"
            : baseline ? "bg-night-tint text-night" : "bg-moss-tint text-moss";

        return (
          <li key={day} className="min-w-0 text-center">
            <span className={`mx-auto grid size-10 place-items-center rounded-pill font-mono text-caption ${tone}`}>
              {isDone && !isToday ? "✓" : day}
            </span>
            <span className="mt-2 block text-caption text-muted">Day {day}</span>
            <span className="block text-[11px] leading-tight text-muted">{baseline ? "Baseline" : "Test"}</span>
            {isToday && <span className="mt-1 block text-[11px] font-medium text-moss">Today</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ExperimentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/experiments/${id}`)}`);
      return;
    }
    let cancelled = false;
    getExperiment(id).then((item) => {
      if (!cancelled) setExperiment(item);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      const status = cause instanceof ApiError ? cause.status : 0;
      setError({ status, message: cause instanceof Error ? cause.message : "Something went wrong." });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, session, sessionLoading, router, attempt]);

  if (sessionLoading || (!session && !error)) {
    return <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">{detailSkeleton}</div>;
  }

  if (loading || !experiment && !error) {
    return <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">{detailSkeleton}</div>;
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
          <h1 className="font-display text-title">
            {notFound ? "We couldn’t find that experiment" : "We couldn’t load your experiment"}
          </h1>
          {!notFound && <p className="mt-2">{error.message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {!notFound && <button type="button" className="min-h-11 rounded-pill bg-paper px-5 text-ink" onClick={() => {
              setLoading(true);
              setError(null);
              setAttempt((value) => value + 1);
            }}>Try again</button>}
            <Link href="/" className="inline-flex min-h-11 items-center underline">Back to your lab</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!experiment) return null;
  const { progress } = experiment;
  const phaseText = progress.phase
    ? `${phaseLabel(progress.phase)} · day ${progress.phase_day ?? "—"} of ${progress.phase_days ?? "—"}`
    : phaseLabel(progress.phase);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
      <Link href="/" className="inline-flex min-h-11 items-center text-moss hover:underline">← Your lab</Link>
      <p className="mt-6 font-mono text-caption text-moss">Your experiment</p>
      <h1 className="mt-2 max-w-4xl font-display text-headline sm:text-display-sm">{experiment.question}</h1>
      <p className="mt-3 text-lead text-muted">{progressMessage(experiment)}</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Experiment progress">
        <div className="rounded-card bg-paper p-5">
          <p className="text-caption text-muted">Progress</p>
          <p className="mt-2 font-display text-title">
            {progress.state === "in_progress" ? `Day ${progress.day_number ?? "—"} of ${progress.total_days}` : `${progress.total_days} days`}
          </p>
        </div>
        <div className="rounded-card bg-paper p-5">
          <p className="text-caption text-muted">Phase</p>
          <p className="mt-2 font-display text-title">{phaseText}</p>
        </div>
        <div className="rounded-card bg-paper p-5">
          <p className="text-caption text-muted">Days remaining</p>
          <p className="mt-2 font-display text-title">{progress.days_remaining ?? (progress.state === "completed" ? "Complete" : "—")}</p>
        </div>
      </section>

      <section className="mt-9 rounded-card border border-line bg-paper p-5 sm:p-7">
        <h2 className="mb-5 font-display text-title">Your timeline</h2>
        <ExperimentTimeline experiment={experiment} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-card bg-paper p-6 sm:p-7">
          <p className="font-mono text-caption text-moss">The small change</p>
          <h2 className="mt-2 font-display text-title">{experiment.intervention.action}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-caption text-muted">When</dt><dd>{experiment.intervention.timing}</dd></div>
            <div><dt className="text-caption text-muted">How often</dt><dd>{experiment.intervention.frequency}</dd></div>
          </dl>
          <p className="mt-6 rounded-card bg-oat p-4 text-body">Daily check-ins arrive soon.</p>
        </section>
        <ForecastCard prediction={experiment.prediction} metrics={experiment.metrics} />
      </div>
    </div>
  );
}
