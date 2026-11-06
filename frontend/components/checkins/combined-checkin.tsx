"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLeaveGuard } from "@/components/nav/navigation";
import { WONT_BE_KEPT } from "@/lib/nav/routes";
import { CheckinSteps } from "./checkin-steps";
import { CheckinSaved } from "./checkin-saved";
import type { CheckinStep } from "./step-model";
import { CheckinSkeleton, Shell, secondaryButton, without } from "@/components/checkins/checkin-chrome";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getTodayCheckin, saveTodayCheckin } from "@/lib/data/checkins";
import { type MetricValue, type TodayCheckin } from "@/lib/types/api";

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
  if (ids.length === 1) return `For ${today.experiments.find((item) => item.id === ids[0])?.short_name ?? "one experiment"}`;
  return ids.length === 2 ? "For both experiments" : `For all ${ids.length} experiments`;
}

/** One check-in for every experiment due today. The backend decides what combines and saves it all or not at all. */
export function CombinedCheckin() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ values: {}, texts: {}, changes: {}, note: "" });
  const [loadedAnswers, setLoadedAnswers] = useState<Answers>(answers);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useLeaveGuard(!saved && !saving && JSON.stringify(answers) !== JSON.stringify(loadedAnswers) ? WONT_BE_KEPT.answers : null);
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const [hasSaved, setHasSaved] = useState(false);

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
        setLoadedAnswers(answersFrom(today));
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

  const reload = () => {
    setHasSaved(false);
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
      <Shell>
        <h1 className="font-display text-display-sm tracking-tight">Today&apos;s check-in.</h1>
        <p className="mt-3 text-lead text-muted">No check-in is open right now.</p>
      </Shell>
    );
  }
  if (saved) return <CheckinSaved items={today.experiments.map(item => ({ id: item.id, day: item.day_number, total: item.total_days, name: item.short_name || "Your experiment" }))} onEdit={() => setSaved(false)} />;

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
      setHasSaved(true);
      setLoadedAnswers(answers);
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

  const steps: CheckinStep[] = [
    ...testing.map(item => ({ key: `change:${item.id}`, kind: "change" as const, name: item.short_name || "Made the change", action: item.action, short: item.change_short, timing: item.timing })),
    ...today.questions.map(question => ({ key: question.id, kind: "metric" as const, metric: question.metric, audience: audience(question.experiment_ids, today) })),
  ];
  const editing = hasSaved || today.experiments.some(item => item.recorded);
  return <Shell wide>
    <CheckinSteps steps={steps} values={{ ...answers.values, ...Object.fromEntries(Object.entries(answers.changes).map(([id, value]) => [`change:${id}`, value])) }} texts={answers.texts}
      fields={fieldErrors} note={answers.note} onNote={note => setAnswers(a => ({ ...a, note }))} busy={saving} editing={editing} blocked={stale}
      context={`For all ${today.experiments.length} experiments`} notice={editing ? "Saving replaces today's answers." : undefined}
      saveLabel={saving ? "Saving…" : editing ? "Update check-in" : "Save check-in"} onSave={() => void handleSubmit()}
      onAnswer={(key, value, text) => {
        if (key.startsWith("change:")) setAnswers(a => ({ ...a, changes: { ...a.changes, [key.slice(7)]: value as boolean | undefined } }));
        else setAnswers(a => ({ ...a, values: { ...a.values, [key]: value }, texts: { ...a.texts, [key]: text } }));
        setFieldErrors(e => without(e, key));
      }}
      alert={formError && <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-card bg-clay-tint p-4 text-clay"><p>{formError}</p>{stale && <button type="button" onClick={reload} className={`${secondaryButton} mt-3`}>Reload today&apos;s check-in</button>}</div>} />
  </Shell>;
}
