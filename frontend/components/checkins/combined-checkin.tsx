"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CheckinSkeleton, Shell, primaryButton, secondaryButton, without } from "@/components/checkins/checkin-form";
import { MetricInput } from "@/components/checkins/metric-input";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getTodayCheckin, saveTodayCheckin } from "@/lib/data/checkins";
import { MAX_NOTE_LENGTH, type MetricValue, type TodayCheckin } from "@/lib/types/api";

type Load = { kind: "loading" } | { kind: "ready"; today: TodayCheckin } | { kind: "error"; message: string };
type Answers = {
  values: Record<string, MetricValue | undefined>;
  texts: Record<string, string>;
  changes: Record<string, boolean | undefined>;
  note: string;
};

const SIGN_IN = `/sign-in?next=${encodeURIComponent("/check-in")}`;

function answersFrom(today: TodayCheckin): Answers {
  const values: Answers["values"] = {};
  const texts: Answers["texts"] = {};
  for (const question of today.questions) {
    if (question.value === null || question.value === undefined) continue;
    values[question.id] = question.value;
    texts[question.id] = typeof question.value === "number" ? String(question.value) : "";
  }
  const changes: Answers["changes"] = {};
  for (const experiment of today.experiments) {
    if (experiment.change_required && experiment.change_made !== null && experiment.change_made !== undefined) changes[experiment.id] = experiment.change_made;
  }
  return { values, texts, changes, note: today.note ?? "" };
}

function audience(ids: string[], today: TodayCheckin) {
  if (ids.length === 1) return `For: ${today.experiments.find((item) => item.id === ids[0])?.question ?? ""}`;
  return ids.length === 2 ? "For both experiments" : `For all ${ids.length} experiments`;
}

/** One check-in for every experiment due today. The backend decides what combines and saves it all or not at all. */
export function CombinedCheckin() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ values: {}, texts: {}, changes: {}, note: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  const noteId = useId();

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(SIGN_IN);
      return;
    }
    let cancelled = false;
    getTodayCheckin()
      .then((today) => {
        if (cancelled) return;
        if (today.experiments.length === 1) {
          router.replace(`/experiments/${encodeURIComponent(today.experiments[0].id)}/check-in`);
          return;
        }
        setLoad({ kind: "ready", today });
        setAnswers(answersFrom(today));
        setFieldErrors({});
        setFormError(null);
        setStale(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) router.replace(SIGN_IN);
        else setLoad({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load this. Try again." });
      });
    return () => { cancelled = true; };
  }, [session, sessionLoading, router, attempt]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);
  useEffect(() => {
    if (saved) savedRef.current?.focus();
  }, [saved]);

  const reload = () => {
    setLoad({ kind: "loading" });
    setSaved(false);
    setAttempt((n) => n + 1);
  };

  if (load.kind === "loading") return <CheckinSkeleton />;
  if (load.kind === "error") {
    return (
      <Shell>
        <div role="alert" className="rounded-card bg-clay-tint p-5 text-clay">
          <p className="font-medium">Couldn&apos;t load today&apos;s check-in: {load.message}</p>
          <button type="button" onClick={reload} className={`${secondaryButton} mt-4`}>Try again</button>
        </div>
      </Shell>
    );
  }

  const { today } = load;
  if (today.experiments.length === 0) {
    return (
      <Shell back="/" backLabel="Your lab">
        <h1 className="font-display text-display-sm tracking-tight">Today&apos;s check-in.</h1>
        <p className="mt-3 text-lead text-muted">No check-in is open right now.</p>
      </Shell>
    );
  }
  if (saved) {
    return (
      <Shell>
        <h1 ref={savedRef} tabIndex={-1} className="font-display text-display-sm tracking-tight">Today&apos;s check-ins are recorded.</h1>
        <ul className="mt-5 space-y-2 text-body">
          {today.experiments.map((experiment) => (
            <li key={experiment.id}><span className="font-mono text-caption text-moss tabular-nums">Day {experiment.day_number} of {experiment.total_days}</span><br />{experiment.question}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={primaryButton}>Back to your lab</Link>
          <button type="button" onClick={() => setSaved(false)} className={secondaryButton}>Change today&apos;s answers</button>
        </div>
      </Shell>
    );
  }

  const testing = today.experiments.filter((experiment) => experiment.change_required);

  async function handleSubmit() {
    if (inFlight.current) return;
    const missing: Record<string, string> = {};
    for (const question of today.questions) {
      if (answers.values[question.id] === undefined) missing[question.id] = answers.texts[question.id]?.trim() ? "Enter a number in range" : "Please answer this";
    }
    for (const experiment of testing) {
      if (answers.changes[experiment.id] === undefined) missing[`change:${experiment.id}`] = "Please answer this";
    }
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormError(`${Object.keys(missing).length === 1 ? "One answer is" : "A few answers are"} still missing.`);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setFormError(null);
    setStale(false);
    try {
      const result = await saveTodayCheckin({
        revision: today.revision,
        answers: Object.fromEntries(today.questions.map((question) => [question.id, answers.values[question.id] as MetricValue])),
        changes: Object.fromEntries(testing.map((experiment) => [experiment.id, answers.changes[experiment.id] as boolean])),
        note: answers.note.trim() || null,
      });
      setLoad({ kind: "ready", today: result });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(SIGN_IN);
        return;
      }
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      if (e instanceof ApiError && typeof e.detail === "object" && e.detail !== null && "code" in e.detail && e.detail.code === "checkin_changed") setStale(true);
      setFormError(e instanceof ApiError && e.status !== 0 ? e.message : "Couldn't reach the server. Your answers are still here, so try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Shell back="/" backLabel="Your lab">
      <h1 className="font-display text-display-sm tracking-tight">Today&apos;s check-in.</h1>
      <p className="mt-3 text-lead text-muted">One check-in for your {today.experiments.length} experiments. Shared questions are asked once.</p>
      {today.experiments.some((experiment) => experiment.recorded) && (
        <p className="mt-4 rounded-card bg-moss-tint p-3 text-body">You&apos;ve already checked in for some of these today. Saving again replaces those answers.</p>
      )}
      <form
        noValidate
        className="mt-8 space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {testing.map((experiment) => {
          const field = `change:${experiment.id}`;
          return (
            <fieldset key={experiment.id} aria-invalid={Boolean(fieldErrors[field])}>
              <legend className="text-lead font-medium text-ink">Did you make the change today?</legend>
              <div className="mt-2 rounded-card bg-moss-tint p-3 text-body text-ink">
                <p>{experiment.action}</p>
                <p className="mt-1 text-caption text-muted">When: {experiment.timing}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[{ v: true, label: "Yes" }, { v: false, label: "Not today" }].map(({ v, label }) => {
                  const selected = answers.changes[experiment.id] === v;
                  return (
                    <label
                      key={label}
                      className={`grid min-h-12 cursor-pointer place-items-center rounded-card border text-lead transition-transform duration-[var(--motion-press)] active:scale-[0.98] motion-reduce:transition-none ${
                        selected ? "border-moss bg-moss text-on-accent" : "border-control bg-paper text-ink hover:border-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name={field}
                        checked={selected}
                        onChange={() => {
                          setAnswers((a) => ({ ...a, changes: { ...a.changes, [experiment.id]: v } }));
                          setFieldErrors((e) => without(e, field));
                        }}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
              {fieldErrors[field] && <p className="mt-2 text-caption font-medium text-clay">{fieldErrors[field]}</p>}
            </fieldset>
          );
        })}

        {today.questions.map((question) => (
          <div key={question.id}>
            <p className="mb-2 text-caption text-moss">{audience(question.experiment_ids, today)}</p>
            <MetricInput
              metric={question.metric}
              value={answers.values[question.id]}
              text={answers.texts[question.id] ?? ""}
              error={fieldErrors[question.id]}
              onChange={(value, text) => {
                setAnswers((a) => ({ ...a, values: { ...a.values, [question.id]: value }, texts: { ...a.texts, [question.id]: text } }));
                setFieldErrors((e) => without(e, question.id));
              }}
            />
          </div>
        ))}

        <div>
          <label htmlFor={noteId} className="text-lead font-medium text-ink">Anything unusual yesterday? (optional)</label>
          <p className="mt-1 text-caption text-muted">Saved with every experiment here.</p>
          <textarea
            id={noteId}
            value={answers.note}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            onChange={(event) => setAnswers((a) => ({ ...a, note: event.target.value }))}
            placeholder="Late night, a stressful day, a long run…"
            className="mt-2 w-full rounded-control border border-control bg-paper p-3 text-body text-ink"
          />
          {fieldErrors.note && <p className="mt-2 text-caption font-medium text-clay">{fieldErrors.note}</p>}
        </div>

        {formError && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-card bg-clay-tint p-4 text-clay">
            <p>{formError}</p>
            {stale && <button type="button" onClick={reload} className={`${secondaryButton} mt-3 text-ink`}>Reload today&apos;s check-in</button>}
          </div>
        )}

        <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButton} w-full sm:w-auto`}>
          {saving ? "Saving…" : today.experiments.some((experiment) => experiment.recorded) ? "Update check-in" : "Save check-in"}
        </button>
      </form>
    </Shell>
  );
}
