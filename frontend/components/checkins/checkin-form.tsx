"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLeaveGuard } from "@/components/nav/navigation";
import { WONT_BE_KEPT } from "@/lib/nav/routes";
import { CheckinSteps } from "./checkin-steps";
import { type CheckinStep } from "./step-model";
import { CheckinSkeleton, primaryButton, secondaryButton, Shell, without } from "@/components/checkins/checkin-chrome";
import { CheckinSaved } from "@/components/checkins/checkin-saved";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins, submitCheckin } from "@/lib/data/checkins";
import { getExperiment, getExperimentProgress } from "@/lib/data/experiments";
import { type Checkin, type Experiment, type MetricValue } from "@/lib/types/api";

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
  const inFlight = useRef(false);
  const [dayChanged, setDayChanged] = useState(false);
  useLeaveGuard(!saved && !saving && JSON.stringify(answers) !== JSON.stringify(loadedAnswers) ? WONT_BE_KEPT.answers : null);
  const signInPath = `/sign-in?next=${encodeURIComponent(`/experiments/${id}/check-in`)}`;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(signInPath);
      return;
    }
    let cancelled = false;
    Promise.all([getExperiment(id), listCheckins(id), getExperimentProgress(id)])
      .then(([snapshot, checkins, timeline]) => {
        const experiment = { ...snapshot, progress: timeline.progress };
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

  const steps: CheckinStep[] = [
    ...(testDay ? [{ key: "intervention_completed", kind: "change" as const, name: "Made the change", action: experiment.intervention.action, short: experiment.intervention.change_short, timing: experiment.intervention.timing }] : []),
    ...metrics.map(metric => ({ key: metric.key, kind: "metric" as const, metric })),
  ];

  if (saved) {
    return <CheckinSaved items={[{ id, day: saved.day_number, total: progress.total_days, name: experiment.intervention.short_name || "Your experiment", sample: experiment.is_seeded }]} onEdit={() => setSaved(null)} />;
  }

  const setValue = (key: string, value: MetricValue | undefined, text: string) => {
    setAnswers((a) => ({ ...a, values: { ...a.values, [key]: value }, texts: { ...a.texts, [key]: text } }));
    setFieldErrors((e) => without(e, key));
  };

  async function handleSubmit() {
    if (inFlight.current || dayChanged) return;
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

    inFlight.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const fresh = await getExperimentProgress(id);
      if (fresh.progress.state !== "in_progress" || fresh.progress.day_number !== day) {
        setDayChanged(true); setFormError("Today has changed. Go back to Today to load the current day before saving."); return;
      }
      const metric_values: Record<string, MetricValue> = {};
      for (const m of metrics) metric_values[m.key] = answers.values[m.key] as MetricValue;
      const result = await submitCheckin(id, {
        metric_values,
        intervention_completed: testDay ? answers.interventionDone : undefined,
        note: answers.note.trim() || null,
      });
      setSaved(result);
      setLoadedAnswers(answers);
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
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <Shell wide>
    {experiment.is_seeded && <p className="mb-3 text-caption">Sample experiment · Sample check-in</p>}
    <CheckinSteps steps={steps} values={{ ...answers.values, intervention_completed: answers.interventionDone }} texts={answers.texts}
      fields={fieldErrors} note={answers.note} onNote={note => setAnswers(a => ({ ...a, note }))} busy={saving} editing={alreadyToday}
      context={`Day ${day} of ${progress.total_days} · ${testDay ? "Test" : "Normal"}`} notice={alreadyToday ? "Saving replaces today's answers." : undefined}
      blocked={dayChanged} saveLabel={saving ? "Saving…" : alreadyToday ? "Update check-in" : "Save check-in"} onSave={() => void handleSubmit()}
      onAnswer={(key, value, text) => {
        if (key === "intervention_completed") { setAnswers(a => ({ ...a, interventionDone: value as boolean | undefined })); setFieldErrors(e => without(e, key)); }
        else setValue(key, value, text);
      }}
      alert={formError && <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-card bg-clay-tint p-4 text-clay"><p>{formError}</p>{dayChanged && <Link href="/" className={`${secondaryButton} mt-3`}>Go to Today</Link>}</div>} />
  </Shell>;
}
