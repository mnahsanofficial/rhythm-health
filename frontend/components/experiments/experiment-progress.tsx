"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import type { Checkin, Experiment, MetricValue } from "@/lib/types/api";

const DAY_MS = 24 * 60 * 60 * 1000;
const primaryButton = "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-paper transition-transform hover:bg-moss-deep active:scale-[0.98] motion-reduce:transition-none";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-pill border border-line bg-paper px-5 text-body font-medium text-ink hover:border-moss";

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

/** The one thing to do now: check in, wait for tomorrow, finish, or read the results. */
export function TodayCard({ experiment, checkins, path }: { experiment: Experiment; checkins: Checkin[]; path: string }) {
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

/** Every day of the experiment. Logged days open to show what was recorded (PRD §13). */
export function Timeline({ experiment, checkins }: { experiment: Experiment; checkins: Checkin[] }) {
  const panelId = useId();
  const reduceMotion = useReducedMotion();
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
                  className="grid min-h-11 w-full place-items-center rounded-card transition-transform active:scale-95 motion-reduce:transition-none"
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

      <div
        id={panelId}
        role="region"
        aria-label="Recorded day"
        aria-live="polite"
        className={checkins.length ? "mt-5 min-h-56 border-t border-line pt-5" : ""}
      >
        {!selected && checkins.length > 0 && (
          <p className="text-body text-muted">Choose a recorded day to revisit your answers.</p>
        )}
        <AnimatePresence initial={false} mode="wait">
          {selected && (
            <motion.article
              aria-label={`Day ${selected.day_number} answers`}
              key={selected.day_number}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="rounded-card bg-oat p-4 sm:p-5"
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
            </motion.article>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

