"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useLeaveGuard } from "@/components/nav/navigation";
import { WONT_BE_KEPT } from "@/lib/nav/routes";
import { AnswerProgress } from "@/components/checkins/answer-progress";
import { ChangeQuestion } from "@/components/checkins/change-question";
import { CheckinSkeleton, primaryButton, secondaryButton, Shell, without } from "@/components/checkins/checkin-chrome";
import { CheckinSaved } from "@/components/checkins/checkin-saved";
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
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>(answersFrom(undefined));
  const [loadedAnswers, setLoadedAnswers] = useState<Answers>(answers);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Checkin | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const noteId = useId();
  useLeaveGuard(!saved && !saving && JSON.stringify(answers) !== JSON.stringify(loadedAnswers) ? WONT_BE_KEPT.answers : null);
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
        const existing = answersFrom(checkins.find((c) => c.day_number === experiment.progress.day_number));
        setAnswers(existing);
        setLoadedAnswers(existing);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setLoad({ kind: "not-found" });
        else if (e instanceof ApiError && e.status === 401) router.replace(signInPath);
        else setLoad({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load this. Try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [id, session, sessionLoading, router, signInPath, attempt]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

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
              Go to your lab
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
      <Shell>
        {experiment.is_seeded && <p className="mb-3 font-medium text-moss">Sample experiment · Sample check-in</p>}
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
    return <CheckinSaved experiment={experiment} checkins={checkins} day={day} experimentPath={experimentPath} onEdit={() => setSaved(null)} />;
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
    <Shell>
      <p className="font-mono text-caption text-moss tabular-nums">
        Day {day} of {progress.total_days} · {testDay ? "Test" : "Baseline"} day {progress.phase_day} of {progress.phase_days}
      </p>
      {experiment.is_seeded && <p className="mb-3 font-medium text-moss">Sample experiment · Sample check-in</p>}
      <h1 className="mt-2 font-display text-display-sm tracking-tight">Today&apos;s check-in.</h1>
      <p className="mt-3 text-lead text-muted">
        {testDay
          ? "A test day. Tell us whether you made the change, then how it went."
          : "A normal day. Don't change anything yet, just notice how it went."}
      </p>
      <AnswerProgress answered={answered} total={answerTotal} />
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
          <ChangeQuestion
            name="intervention_completed"
            action={experiment.intervention.action}
            timing={experiment.intervention.timing}
            value={answers.interventionDone}
            error={fieldErrors.intervention_completed}
            onChange={(v) => {
              setAnswers((a) => ({ ...a, interventionDone: v }));
              setFieldErrors((e) => without(e, "intervention_completed"));
            }}
          />
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
            className="mt-3 w-full resize-y rounded-control border border-control bg-paper p-4 text-body text-ink placeholder:text-muted/70 focus-visible:border-moss"
          />
          {fieldErrors.note && <p className="mt-2 text-caption font-medium text-clay">{fieldErrors.note}</p>}
        </div>

        <div className="sticky bottom-0 -mx-[var(--gutter)] border-t border-line bg-oat px-[var(--gutter)] py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButton} w-full max-w-none sm:w-fit`}>
            {saving ? "Saving…" : alreadyToday ? "Update check-in" : "Save check-in"}
          </button>
        </div>
      </form>
    </Shell>
  );
}
