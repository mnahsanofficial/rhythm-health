"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ForecastCard } from "@/components/experiments/new-experiment";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins } from "@/lib/data/checkins";
import { getExperiment } from "@/lib/data/experiments";
import { completeExperiment, notEnoughCheckins } from "@/lib/data/reports";
import type { Checkin, Experiment, MetricValue } from "@/lib/types/api";

// Mirrors backend/app/services/analysis.py: results need this many check-ins per phase.
const MIN_BASELINE_CHECKINS = 2;
const MIN_TEST_CHECKINS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** When the next rolling 24-hour day begins (days count from the start time, not midnight). */
function nextDayOpens(experiment: Experiment): Date | null {
  const { started_at, day_number } = experiment.progress;
  if (!started_at || day_number === null) return null;
  return new Date(new Date(started_at).getTime() + day_number * DAY_MS);
}

function formatValue(value: MetricValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
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
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
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
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
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

/** The one thing to do now: check in, wait for tomorrow, finish, or read the results. */
function TodayCard({ experiment, checkins, path }: { experiment: Experiment; checkins: Checkin[]; path: string }) {
  const { progress } = experiment;

  if (progress.state === "completed") {
    return (
      <section className="rounded-card bg-moss-tint p-6 sm:p-7">
        <h2 className="font-display text-title">Your results are ready.</h2>
        <p className="mt-2 text-body text-muted">See what changed, and how close the prediction was.</p>
        <Link href={`${path}/report`} className={`${primaryButton} mt-5`}>
          See your Lab Report
        </Link>
      </section>
    );
  }

  if (progress.state === "ended") {
    return (
      <section className="rounded-card bg-moss-tint p-6 sm:p-7">
        <h2 className="font-display text-title">All {progress.total_days} days are done.</h2>
        <p className="mt-2 text-body text-muted">Finish the experiment to see what your check-ins show.</p>
      </section>
    );
  }

  if (progress.state === "not_started" || progress.day_number === null) {
    return (
      <section className="rounded-card bg-paper p-6 sm:p-7">
        <h2 className="font-display text-title">This experiment hasn&apos;t started.</h2>
        <p className="mt-2 text-body text-muted">Nothing to check in yet.</p>
      </section>
    );
  }

  const day = progress.day_number;
  const doneToday = checkins.some((ch) => ch.day_number === day);
  const opens = nextDayOpens(experiment);
  const opensText = opens?.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

  if (doneToday) {
    return (
      <section className="rounded-card bg-moss-tint p-6 sm:p-7">
        <p className="flex items-center gap-2 font-medium text-moss">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Done for today
        </p>
        <h2 className="mt-2 font-display text-title">Day {day} is recorded.</h2>
        {opensText && progress.days_remaining ? (
          <p className="mt-2 text-body text-muted">Day {day + 1} opens {opensText}.</p>
        ) : (
          <p className="mt-2 text-body text-muted">That was the last day.</p>
        )}
        <Link href={`${path}/check-in`} className={`${secondaryButton} mt-5`}>
          Change today&apos;s answers
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-card bg-moss-tint p-6 sm:p-7">
      <h2 className="font-display text-title">Today&apos;s check-in is waiting.</h2>
      <p className="mt-2 text-body text-muted">
        {progress.phase === "intervention"
          ? "A test day: tell us whether you made the change, then how it went."
          : "A baseline day: just record a normal day."}{" "}
        About 30 seconds.
      </p>
      <Link href={`${path}/check-in`} className={`${primaryButton} mt-5`}>
        Check in for day {day}
      </Link>
      {opensText && <p className="mt-3 text-caption text-muted">Day {day} closes {opensText}.</p>}
    </section>
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

/** Every day of the experiment. Logged days open to show what was recorded (PRD §13). */
function Timeline({ experiment, checkins }: { experiment: Experiment; checkins: Checkin[] }) {
  const panelId = useId();
  const [open, setOpen] = useState<number | null>(null);
  const { progress } = experiment;
  const byDay = new Map(checkins.map((ch) => [ch.day_number, ch]));
  const today = progress.state === "in_progress" ? progress.day_number : null;
  const pastThrough =
    progress.state === "in_progress" ? (progress.day_number ?? 1) - 1 : progress.state === "not_started" ? 0 : progress.total_days;
  const selected = open !== null ? byDay.get(open) : undefined;

  return (
    <>
      <ol className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: progress.total_days }, (_, i) => {
          const day = i + 1;
          const baseline = day <= experiment.baseline_days;
          const logged = byDay.get(day);
          const isToday = day === today;
          const missed = !logged && day <= pastThrough;
          const state = logged ? "logged" : isToday ? "today, not logged yet" : missed ? "missed" : "upcoming";
          const tone = logged
            ? baseline
              ? "bg-night text-paper"
              : "bg-moss text-paper"
            : missed
              ? "border border-dashed border-muted bg-transparent text-muted"
              : baseline
                ? "bg-night-tint text-night"
                : "bg-moss-tint text-moss";
          const ring =
            open === day
              ? "ring-2 ring-sun ring-offset-2 ring-offset-paper"
              : isToday
                ? "ring-2 ring-ink ring-offset-2 ring-offset-paper"
                : "";
          const label = `Day ${day}, ${baseline ? "baseline" : "test"}, ${state}`;
          const circle = (
            <span className={`mx-auto grid size-10 place-items-center rounded-full font-mono text-caption tabular-nums ${tone} ${ring}`}>
              {logged ? "✓" : missed ? "–" : day}
            </span>
          );
          return (
            <li key={day} className="min-w-0 text-center">
              {logged ? (
                <button
                  type="button"
                  aria-label={label}
                  aria-expanded={open === day}
                  aria-controls={panelId}
                  onClick={() => setOpen(open === day ? null : day)}
                  className="grid min-h-11 w-full place-items-center rounded-card transition-[scale] active:scale-95"
                >
                  {circle}
                </button>
              ) : (
                <span aria-label={label} className="grid min-h-11 place-items-center">
                  {circle}
                </span>
              )}
              <span className="mt-1 block text-caption text-muted tabular-nums">Day {day}</span>
              {isToday && <span className="block text-caption font-medium text-ink">Today</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-night" /> Baseline
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-moss" /> Test
        </span>
        <span>✓ logged · – missed · tap a logged day to see it</span>
      </p>

      <div id={panelId} aria-live="polite">
        <AnimatePresence initial={false} mode="wait">
          {selected && (
            <motion.div
              key={selected.day_number}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2 }}
              className="mt-5 rounded-card bg-oat p-4 sm:p-5"
            >
              <p className="font-mono text-caption text-moss">
                Day {selected.day_number} · {selected.phase === "intervention" ? "Test" : "Baseline"}
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {selected.phase === "intervention" && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Made the change</dt>
                    <dd className="font-medium">{selected.intervention_completed ? "Yes" : "No"}</dd>
                  </div>
                )}
                {experiment.metrics.map((m) =>
                  selected.metric_values[m.key] === undefined ? null : (
                    <div key={m.key} className="flex justify-between gap-4">
                      <dt className="text-muted">{m.label}</dt>
                      <dd className="shrink-0 font-mono font-medium tabular-nums">
                        {formatValue(selected.metric_values[m.key])}
                        {m.type === "scale" && m.max !== null && <span className="text-muted">/{m.max}</span>}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
              {selected.note && <p className="mt-3 border-t border-line pt-3 text-body">“{selected.note}”</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/** Same shape as the page: heading, today and finish cards, timeline. */
export function ExperimentDetailSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-5xl animate-pulse px-4 pt-8 sm:px-8 sm:pt-14">
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
