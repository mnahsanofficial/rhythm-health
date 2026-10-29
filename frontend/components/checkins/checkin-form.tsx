"use client";

import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MetricInput } from "@/components/checkins/metric-input";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins, submitCheckin } from "@/lib/data/checkins";
import { getExperiment } from "@/lib/data/experiments";
import { MAX_NOTE_LENGTH, type Checkin, type Experiment, type MetricValue } from "@/lib/types/api";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; experiment: Experiment; checkins: Checkin[] }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

type Answers = {
  values: Record<string, MetricValue | undefined>;
  texts: Record<string, string>;
  interventionDone: boolean | undefined;
  note: string;
};

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-7 text-lead font-medium text-paper transition-transform duration-[var(--motion-press)] motion-reduce:transition-none hover:bg-moss-deep active:scale-[0.98] disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill border border-line bg-paper px-5 text-body font-medium text-ink hover:border-moss";

function without(errors: Record<string, string>, key: string): Record<string, string> {
  const next = { ...errors };
  delete next[key];
  return next;
}

/** Answers already saved for today, so a second visit edits instead of starting over. */
function answersFrom(checkin: Checkin | undefined): Answers {
  const values: Answers["values"] = {};
  const texts: Answers["texts"] = {};
  for (const [key, v] of Object.entries(checkin?.metric_values ?? {})) {
    values[key] = v;
    texts[key] = typeof v === "number" ? String(v) : "";
  }
  return {
    values,
    texts,
    interventionDone: checkin?.phase === "intervention" ? checkin.intervention_completed : undefined,
    note: checkin?.note ?? "",
  };
}

/** Today's check-in for one experiment: the PRD's main daily action, aimed at under 30 seconds. */
export function CheckinForm({ id }: { id: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>(answersFrom(undefined));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Checkin | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const noteId = useId();
  const signInPath = `/sign-in?next=${encodeURIComponent(`/experiments/${id}/check-in`)}`;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(signInPath);
      return;
    }
    let cancelled = false;
    Promise.all([getExperiment(id), listCheckins(id)])
      .then(([experiment, checkins]) => {
        if (cancelled) return;
        setLoad({ kind: "ready", experiment, checkins });
        setAnswers(answersFrom(checkins.find((c) => c.day_number === experiment.progress.day_number)));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setLoad({ kind: "not-found" });
        else if (e instanceof ApiError && e.status === 401) router.replace(signInPath);
        else setLoad({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      });
    return () => {
      cancelled = true;
    };
  }, [id, session, sessionLoading, router, signInPath, attempt]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (saved) savedHeadingRef.current?.focus();
  }, [saved]);

  if (load.kind === "loading") return <CheckinSkeleton />;

  if (load.kind === "not-found" || load.kind === "error") {
    return (
      <Shell>
        <div role="alert" className="rounded-card bg-clay-tint p-5 text-clay">
          <p className="font-medium">
            {load.kind === "not-found" ? "We couldn't find that experiment." : `Couldn't load today's check-in: ${load.message}`}
          </p>
          {load.kind === "error" ? (
            <button
              type="button"
              onClick={() => {
                setLoad({ kind: "loading" });
                setAttempt((n) => n + 1);
              }}
              className={`${secondaryButton} mt-4`}
            >
              Try again
            </button>
          ) : (
            <Link href="/" className={`${secondaryButton} mt-4`}>
              Back to home
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  const { experiment, checkins } = load;
  const { progress } = experiment;
  const experimentPath = `/experiments/${encodeURIComponent(id)}`;

  if (progress.state !== "in_progress" || progress.day_number === null) {
    const message = {
      not_started: "This experiment hasn't started yet, so there's nothing to check in.",
      ended: "All the days of this experiment are over. You can finish it and see what happened.",
      completed: "This experiment is complete. Its results are ready.",
      in_progress: "Today's day isn't available.",
    }[progress.state];
    return (
      <Shell back={experimentPath}>
        <h1 className="font-display text-headline tracking-tight">No check-in today.</h1>
        <p className="mt-3 text-lead text-muted">{message}</p>
        <Link href={experimentPath} className={`${primaryButton} mt-8`}>
          Go to your experiment
        </Link>
      </Shell>
    );
  }

  const day = progress.day_number;
  const testDay = progress.phase === "intervention";
  const alreadyToday = checkins.some((c) => c.day_number === day);
  const metrics = [...experiment.metrics].sort((a, b) => Number(b.primary) - Number(a.primary));

  const answerTotal = metrics.length + Number(testDay);
  const answered = metrics.filter((m) => answers.values[m.key] !== undefined).length
    + Number(testDay && answers.interventionDone !== undefined);

  if (saved) {
    const logged = new Set(checkins.map((c) => c.day_number));
    return (
      <Shell back={experimentPath}>
        <div role="status" className="flex flex-col items-start">
          <Tick reduceMotion={Boolean(reduceMotion)} />
          <h1
            ref={savedHeadingRef}
            tabIndex={-1}
            className="mt-5 font-display text-display-sm tracking-tight outline-none"
          >
            Day {day} recorded.
          </h1>
          <p className="mt-3 text-lead text-muted">
            {logged.size} of {progress.total_days} days logged.{" "}
            {progress.days_remaining ? `${progress.days_remaining} to go.` : "That was the last day."}
          </p>
          <ol aria-label="Days logged" className="mt-6 flex flex-wrap gap-1.5">
            {Array.from({ length: progress.total_days }, (_, i) => {
              const n = i + 1;
              const isLogged = logged.has(n);
              return (
                <motion.li
                  key={n}
                  aria-label={`Day ${n}${isLogged ? ", logged" : ""}`}
                  initial={n === day && !reduceMotion ? { scale: 0.7, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
                  className={`grid size-11 place-items-center rounded-pill border font-mono text-caption ${
                    isLogged ? "border-moss bg-moss text-paper" : n <= day ? "border-line bg-paper" : "border-dashed border-line"
                  }`}
                >
                  <span aria-hidden="true">{isLogged ? "✓" : n}</span>
                </motion.li>
              );
            })}
          </ol>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={experimentPath} className={primaryButton}>
              Back to your experiment
            </Link>
            <button type="button" onClick={() => setSaved(null)} className={secondaryButton}>
              Change today&apos;s answers
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const setValue = (key: string, value: MetricValue | undefined, text: string) => {
    setAnswers((a) => ({ ...a, values: { ...a.values, [key]: value }, texts: { ...a.texts, [key]: text } }));
    setFieldErrors((e) => without(e, key));
  };

  async function handleSubmit() {
    const missing: Record<string, string> = {};
    for (const m of metrics) {
      if (answers.values[m.key] === undefined) {
        missing[m.key] = answers.texts[m.key]?.trim() ? "Enter a number in range" : "Please answer this";
      }
    }
    if (testDay && answers.interventionDone === undefined) missing.intervention_completed = "Please answer this";
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormError(`${Object.keys(missing).length === 1 ? "One answer is" : "A few answers are"} still missing.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const metric_values: Record<string, MetricValue> = {};
      for (const m of metrics) metric_values[m.key] = answers.values[m.key] as MetricValue;
      const result = await submitCheckin(id, {
        metric_values,
        intervention_completed: testDay ? answers.interventionDone : undefined,
        note: answers.note.trim() || null,
      });
      setSaved(result);
      // Today now has a check-in: editing again should say so and replace it.
      setLoad((l) =>
        l.kind === "ready"
          ? { ...l, checkins: [...l.checkins.filter((c) => c.day_number !== result.day_number), result] }
          : l,
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(signInPath);
        return;
      }
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      setFormError(
        e instanceof ApiError && e.status !== 0
          ? e.message
          : "Couldn't reach the server. Your answers are still here, so try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell back={experimentPath} backLabel={`Day ${day} of ${progress.total_days}`}>
      <p className="font-mono text-caption text-moss tabular-nums">
        {testDay ? "Test" : "Baseline"} · day {progress.phase_day} of {progress.phase_days}
      </p>
      <h1 className="mt-2 font-display text-display-sm tracking-tight">Today&apos;s check-in.</h1>
      <p className="mt-3 text-lead text-muted">
        {testDay
          ? "A test day. Tell us whether you made the change, then how it went."
          : "A normal day. Don't change anything yet, just notice how it went."}
      </p>
      <div className="mt-6 border-y border-line py-4">
        <div className="flex items-center justify-between gap-4 text-caption">
          <p role="status" className="font-mono tabular-nums">
            {answered} of {answerTotal} answered
          </p>
          <span className="text-muted">{answered === answerTotal ? "Ready to record" : "Note optional"}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Check-in answers"
          aria-valuemin={0}
          aria-valuemax={answerTotal}
          aria-valuenow={answered}
          className="mt-3 h-1 overflow-hidden rounded-pill bg-line"
        >
          <motion.div
            initial={false}
            animate={{ scaleX: answerTotal ? answered / answerTotal : 0 }}
            transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
            className="h-full origin-left bg-moss"
          />
        </div>
      </div>
      {alreadyToday && (
        <p className="mt-4 rounded-card bg-moss-tint p-3 text-body text-ink">
          You&apos;ve already checked in today. Saving again replaces those answers.
        </p>
      )}

      <form
        noValidate
        className="mt-8 flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        {formError && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-card bg-clay-tint p-4 text-clay outline-none">
            <p className="font-medium">{formError}</p>
          </div>
        )}

        {testDay && (
          <fieldset aria-invalid={Boolean(fieldErrors.intervention_completed)}>
            <legend className="text-lead font-medium text-ink">Did you make the change today?</legend>
            {/* Shown as written: the AI's wording can run to several sentences. */}
            <div className="mt-2 rounded-card bg-moss-tint p-3 text-body text-ink">
              <p>{experiment.intervention.action}</p>
              <p className="mt-1 text-caption text-muted">When: {experiment.intervention.timing}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { v: true, label: "Yes" },
                { v: false, label: "Not today" },
              ].map(({ v, label }) => {
                const selected = answers.interventionDone === v;
                return (
                  <label
                    key={label}
                    className={`grid min-h-12 cursor-pointer place-items-center rounded-card border text-lead transition-transform duration-[var(--motion-press)] motion-reduce:transition-none active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
                      selected ? "border-moss bg-moss text-paper" : "border-line bg-paper text-ink hover:border-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="intervention_completed"
                      checked={selected}
                      onChange={() => {
                        setAnswers((a) => ({ ...a, interventionDone: v }));
                        setFieldErrors((e) => without(e, "intervention_completed"));
                      }}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {fieldErrors.intervention_completed && (
              <p className="mt-2 text-caption font-medium text-clay">{fieldErrors.intervention_completed}</p>
            )}
          </fieldset>
        )}

        {metrics.map((m) => (
          <MetricInput
            key={m.key}
            metric={m}
            value={answers.values[m.key]}
            text={answers.texts[m.key] ?? ""}
            onChange={(v, t) => setValue(m.key, v, t)}
            error={fieldErrors[m.key]}
          />
        ))}

        <div>
          <label htmlFor={noteId} className="text-lead font-medium text-ink">
            Anything unusual yesterday? <span className="text-body font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={noteId}
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            value={answers.note}
            onChange={(e) => setAnswers((a) => ({ ...a, note: e.target.value }))}
            placeholder="Late night, a stressful day, a long run…"
            className="mt-3 w-full resize-y rounded-card border border-line bg-paper p-4 text-body text-ink placeholder:text-muted/70 focus-visible:border-moss"
          />
          {fieldErrors.note && <p className="mt-2 text-caption font-medium text-clay">{fieldErrors.note}</p>}
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-line bg-oat/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButton} w-full sm:w-auto`}>
            {saving ? "Saving…" : alreadyToday ? "Update today's check-in" : "Save today's check-in"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({
  children,
  back,
  backLabel = "Your experiment",
}: {
  children: React.ReactNode;
  back?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
      {back && (
        <Link href={back} className="-mx-1 mb-6 inline-flex min-h-11 items-center px-1 text-body text-moss hover:underline">
          ← {backLabel}
        </Link>
      )}
      {children}
    </div>
  );
}

/** A single settling tick confirms the successful save. */
function Tick({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="size-20"
      aria-hidden="true"
      initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}
    >
      <circle cx="24" cy="24" r="22" fill="var(--color-moss-tint)" />
      <path
        d="M14 24.5 L21 31.5 L34 17"
        fill="none"
        stroke="var(--color-moss)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

/** Same shape as the form: header, three questions, the save button. */
export function CheckinSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-8 sm:pt-10">
      <div className="h-5 w-32 rounded-pill bg-line" />
      <div className="mt-8 h-3 w-36 rounded-pill bg-line" />
      <div className="mt-3 h-10 w-2/3 rounded-pill bg-line" />
      <div className="mt-3 h-4 w-full rounded-pill bg-line" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-8">
          <div className="h-4 w-40 rounded-pill bg-line" />
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} className="h-12 rounded-card bg-line/70" />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-10 h-12 w-56 rounded-pill bg-line" />
    </div>
  );
}
