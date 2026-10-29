"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listExperiments, proposeExperiment, saveExperiment, startExperiment } from "@/lib/data/experiments";
import { getProfile } from "@/lib/data/profile";
import type { Experiment, Profile, ProposeResponse } from "@/lib/types/api";
import { GOAL_QUESTIONS } from "@/components/onboarding/steps";

const primary = "min-h-12 rounded-pill bg-moss px-6 py-3 font-medium text-paper hover:bg-moss-deep disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "min-h-11 rounded-pill border border-line bg-paper px-5 py-2 font-medium hover:border-moss";

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

function PredictionRange({ min, max }: { min: number; max: number }) {
  const reduce = useReducedMotion();
  const extent = Math.max(Math.abs(min), Math.abs(max), 1);
  const span = extent * 2;
  const position = (value: number) => ((value + extent) / span) * 100;
  const left = position(Math.min(min, max));
  const width = position(Math.max(min, max)) - left;
  const endpoint = Math.round(extent);

  return (
    <div className="mt-5" aria-label={`Expected change range ${signedPercent(min)} to ${signedPercent(max)}`}>
      <div className="relative h-3 rounded-pill bg-line">
        <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: "50%" }} />
        <motion.div
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, transformOrigin: "left" }}
          className="absolute inset-y-0 rounded-pill bg-night"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-caption text-muted">
        <span>{signedPercent(-endpoint)}</span>
        <span>0%</span>
        <span>{signedPercent(endpoint)}</span>
      </div>
    </div>
  );
}

export function ForecastCard({ prediction, metrics }: {
  prediction: Experiment["prediction"];
  metrics: Experiment["metrics"];
}) {
  const reduce = useReducedMotion();
  const metricLabel = metrics.find((metric) => metric.key === prediction.target_metric)?.label
    ?? prediction.target_metric;
  const directionText = {
    increase: "likely to go up",
    decrease: "likely to go down",
    no_change: "likely to stay about the same",
  }[prediction.direction];

  return (
    <div className="rounded-card border-t-4 border-night bg-night-tint p-5 sm:p-7">
      <p className="text-caption font-medium text-night">The original forecast</p>
      <h2 className="mt-2 font-display text-title">{metricLabel} is {directionText}</h2>
      <p className="mt-4 font-mono text-headline tracking-tight tabular-nums">
        <motion.span initial={reduce ? false : { opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.28 }}>
          {signedPercent(prediction.expected_change_min)} to {signedPercent(prediction.expected_change_max)}
        </motion.span>
      </p>
      <PredictionRange min={prediction.expected_change_min} max={prediction.expected_change_max} />
      <p className="mt-5 text-caption text-muted">Confidence: <span className="font-medium capitalize text-ink">{prediction.confidence}</span></p>
      <p className="mt-3">{prediction.reasoning}</p>
      {prediction.uncertainty_factors.length > 0 && (
        <div className="mt-4">
          <p className="text-caption font-medium">Things that may affect the result</p>
          <ul className="mt-2 list-inside list-disc text-caption text-muted">
            {prediction.uncertainty_factors.map((factor) => <li key={factor}>{factor}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProposalPreview({ result, onStart, onAskSomethingElse, starting, startDisabled }: {
  result: ProposeResponse;
  onStart: () => void;
  onAskSomethingElse: () => void;
  starting: boolean;
  startDisabled: boolean;
}) {
  const proposal = result.proposal;
  const prediction = result.prediction;
  if (!proposal || !prediction) return null;
  const totalDays = proposal.baseline_days + proposal.intervention_days;

  return (
    <section
      aria-label="Experiment and prediction preview"
      className="mt-6"
    >
      {result.classification.risk === "review" && (
        <div role="note" className="mb-6 rounded-card bg-clay-tint p-4 text-clay">
          <p className="font-medium">A note before you begin</p>
          <p className="mt-1">{result.safety.reason}</p>
        </div>
      )}

      <p className="font-mono text-caption text-moss">Your question</p>
      <h1 className="mt-2 max-w-4xl font-display text-headline tracking-tight sm:text-display-sm">{proposal.question}</h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div>

      <div>
        <h2 className="font-display text-title">The hypothesis</h2>
        <p className="mt-2 text-muted">{proposal.hypothesis}</p>
      </div>

      <div className="mt-7 rounded-card bg-oat p-5">
        <h2 className="font-display text-title">The small change</h2>
        <p className="mt-3 font-medium">{proposal.intervention.action}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-muted">When</dt>
            <dd>{proposal.intervention.timing}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">How often</dt>
            <dd>{proposal.intervention.frequency}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-title">A {totalDays}-day timeline</h2>
          <p className="text-caption text-muted">{proposal.baseline_days} baseline · {proposal.intervention_days} test</p>
        </div>
        <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: totalDays }, (_, index) => {
            const baseline = index < proposal.baseline_days;
            return (
              <li key={index} className="min-w-0 text-center">
                <span className={`mx-auto grid size-9 place-items-center rounded-pill font-mono text-caption ${baseline ? "bg-night-tint text-night" : "bg-moss-tint text-moss"}`}>
                  {index + 1}
                </span>
                <span className="mt-1 block text-[11px] leading-tight text-muted">
                  {baseline ? "Baseline" : "Test"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-7 border-t border-line pt-6">
        <h2 className="font-display text-title">What we&apos;ll notice</h2>
        <ul className="mt-3 space-y-2">
          {proposal.metrics.map((metric) => (
            <li key={metric.key} className="flex items-center gap-3">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${metric.primary ? "bg-moss" : "bg-muted"}`} />
              <span>{metric.label}</span>
              {metric.primary && <span className="text-caption text-muted">Primary</span>}
            </li>
          ))}
        </ul>
      </div>

      </div>
      <aside className="lg:sticky lg:top-8" aria-label="Your prediction">
        <ForecastCard prediction={prediction} metrics={proposal.metrics} />
      </aside>
      </div>

      <div className="mt-7 rounded-card border border-line p-4 text-body">
        <p className="font-medium">This plan and prediction become fixed once you start.</p>
        <p className="mt-1 text-caption text-muted">Your original forecast stays in place so you can compare it with what happens.</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={onStart} disabled={starting || startDisabled} className={`${primary} w-full sm:w-auto`}>
          {starting ? "Saving your experiment…" : "Start this experiment"}
        </button>
        <button type="button" onClick={onAskSomethingElse} disabled={starting} className={secondary}>
          Ask something else
        </button>
      </div>
    </section>
  );
}

function starters(profile: Profile): string[] {
  const questions = profile.goals.slice(0, 2).map((goal) =>
    GOAL_QUESTIONS[goal as keyof typeof GOAL_QUESTIONS] ?? `What small change could help with: ${goal}?`,
  );
  const examples = [
    { question: "Does walking after dinner improve my sleep?", goals: ["Fall asleep faster"] },
    { question: "Does less caffeine improve my focus?", goals: ["Better focus"] },
    { question: "Does waking earlier actually improve my productivity?", goals: ["More energy in the morning"] },
  ];
  const distinctExamples = examples
    .filter(({ goals }) => !profile.goals.some((goal) => goals.includes(goal)))
    .map(({ question }) => question);
  return [...new Set([...questions, ...distinctExamples])].filter((question) => question.length <= 500);
}

function ProposalSkeleton() {
  return (
    <section aria-label="Preparing your experiment" className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
      <p role="status" className="text-lead font-medium">
        Finding a small change you can test…
      </p>
      <p className="mt-2 text-muted">Your plan and forecast will arrive together. This can take a little while.</p>
      <ol aria-label="What goes into your experiment" className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["01", "A suitable question", "Check that this fits a small habit experiment."],
          ["02", "A plan for your day", "Shape one change around your routine."],
          ["03", "An honest forecast", "Estimate a range, including what is uncertain."],
        ].map(([number, title, description]) => (
          <li key={number} className="border-t border-line pt-3">
            <span aria-hidden="true" className="font-mono text-caption text-moss">{number}</span>
            <p className="mt-1 font-medium">{title}</p>
            <p className="mt-1 text-caption text-muted">{description}</p>
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="mt-7 space-y-5 motion-safe:animate-pulse">
        <div className="h-8 w-3/4 rounded-pill bg-line" />
        <div className="h-16 rounded-card bg-oat" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-card bg-oat" />
          <div className="h-24 rounded-card bg-moss-tint" />
        </div>
        <div className="h-24 rounded-card bg-oat" />
      </div>
    </section>
  );
}

export function NewExperiment({ initialQuestion = "" }: { initialQuestion?: string }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [question, setQuestion] = useState(
    initialQuestion.length >= 5 && initialQuestion.length <= 500 ? initialQuestion : "",
  );
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [error, setError] = useState<{
    status: number;
    message: string;
    stage: "active-check" | "proposal";
  } | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [savedExperimentId, setSavedExperimentId] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const output = useRef<HTMLElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/sign-in?next=/experiments/new");
      return;
    }
    let cancelled = false;
    getProfile().then((profile) => {
      if (cancelled) return;
      if (!profile) router.replace("/onboarding");
      else setLoaded({ userId: session.user.id, profile });
    }).catch((e: Error) => {
      if (cancelled) return;
      if (e instanceof ApiError && e.status === 401) router.replace("/sign-in?next=/experiments/new");
      else setProfileError(e.message);
    });
    return () => { cancelled = true; };
  }, [loading, session, router, attempt]);

  useEffect(() => {
    if (result) output.current?.focus();
    else input.current?.focus();
  }, [result]);

  async function submit() {
    const text = question.trim();
    if (inFlight.current || text.length < 5 || text.length > 500) return;
    inFlight.current = true;
    setBusy(true);
    setCheckingActive(true);
    setError(null);
    setStartError(null);
    setActiveExperiment(null);
    setResult(null);
    let activeCheckComplete = false;
    try {
      const activeExperiments = await listExperiments("active");
      activeCheckComplete = true;
      setCheckingActive(false);
      if (activeExperiments.length > 0) {
        setActiveExperiment(activeExperiments[0]);
        setStartError("You already have an active experiment.");
        return;
      }

      const response = await proposeExperiment(text);
      if (response.safety.allowed && (!response.proposal || !response.prediction)) {
        throw new ApiError(502, "The plan came back incomplete. Please retry.");
      }
      setResult(response);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401) router.replace("/sign-in?next=/experiments/new");
      setError({
        status,
        message: e instanceof Error ? e.message : "Something went wrong. Please try again.",
        stage: activeCheckComplete ? "proposal" : "active-check",
      });
    } finally {
      inFlight.current = false;
      setCheckingActive(false);
      setBusy(false);
    }
  }

  function chooseQuestion(value: string) {
    setQuestion(value);
    setResult(null);
    setError(null);
    setStartError(null);
    setSavedExperimentId(null);
    setActiveExperiment(null);
    input.current?.focus();
  }

  async function beginExperiment() {
    if (!result?.proposal || !result.prediction || inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setStartError(null);
    setActiveExperiment(null);
    let experimentId = savedExperimentId;
    try {
      if (!experimentId) {
        const activeExperiments = await listExperiments("active");
        if (activeExperiments.length > 0) {
          setActiveExperiment(activeExperiments[0]);
          setStartError("You already have an active experiment.");
          return;
        }
        const saved = await saveExperiment({
          proposal: result.proposal,
          prediction: result.prediction,
          category: result.classification.category,
        });
        experimentId = saved.id;
        setSavedExperimentId(saved.id);
      }
      const active = await startExperiment(experimentId);
      router.push(`/experiments/${encodeURIComponent(active.id)}`);
    } catch (cause) {
      if (experimentId) {
        setSavedExperimentId(experimentId);
        if (cause instanceof ApiError && cause.status === 409 && cause.message.toLowerCase().includes("active")) {
          setStartError("Your experiment was saved, but it couldn’t be started because another experiment is active.");
          try {
            const activeExperiments = await listExperiments("active");
            setActiveExperiment(activeExperiments[0] ?? null);
          } catch {
            setStartError("Your experiment was saved, but we couldn’t check which experiment is active. You can retry starting it.");
          }
        } else {
          setStartError(`Your experiment was saved, but it couldn’t be started: ${cause instanceof Error ? cause.message : "Please try again."}`);
        }
      } else {
        setStartError(cause instanceof Error ? cause.message : "Couldn’t check for an active experiment. Please try again.");
      }
    } finally {
      inFlight.current = false;
      setStarting(false);
    }
  }

  const profile = session && loaded?.userId === session.user.id ? loaded.profile : null;
  if (loading || !session || !profile) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      {profileError ? <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
        <p>Couldn&apos;t load your rhythm: {profileError}</p>
        <button className={`${secondary} mt-4 text-ink`} onClick={() => { setProfileError(null); setAttempt((n) => n + 1); }}>Try again</button>
      </div> : <div role="status"><span className="sr-only">Loading your rhythm</span><div aria-hidden="true" className="space-y-6"><div className="h-12 w-3/4 rounded-pill bg-line" /><div className="h-56 rounded-card bg-paper" /><div className="h-32 rounded-card bg-paper" /></div></div>}
    </div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
      <Link href="/" className="inline-flex min-h-11 items-center text-moss hover:underline">← Your lab</Link>
      <div className={`mt-5 grid gap-10 ${result?.safety.allowed ? "" : "lg:grid-cols-[1fr_280px] lg:gap-14"}`}>
        <div className="min-w-0">
          {!result?.safety.allowed && <>
          <p className="font-mono text-caption text-moss">A little curiosity, a little evidence</p>
          <h1 className="mt-3 font-display text-display-sm tracking-tight sm:text-display">Ask a question.</h1>
          <p className="mt-4 text-lead text-muted">What have you been wondering about your daily habits? Let&apos;s turn it into something you can test.</p>
          <form className="mt-8" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label htmlFor="question" className="block font-medium">Your question or goal</label>
            <textarea ref={input} id="question" required minLength={5} maxLength={500} disabled={busy} value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setError(null);
                setResult(null);
                setStartError(null);
                setActiveExperiment(null);
              }}
              aria-describedby="question-help question-count" rows={4}
              placeholder="Does walking after dinner improve my sleep?"
              className="mt-3 w-full resize-y rounded-card border border-line bg-paper p-4 text-body placeholder:text-muted disabled:opacity-70" />
            <div className="mt-2 flex justify-between gap-4 text-caption text-muted"><p id="question-help">5–500 characters. One small change at a time.</p><span id="question-count" className="font-mono">{question.length}/500</span></div>
            <button type="submit" disabled={busy || question.trim().length < 5 || !!result?.safety.allowed} className={`${primary} mt-5 w-full sm:w-auto`}>
              {checkingActive ? "Checking your experiment…" : busy ? "Shaping your experiment…" : "Design my experiment"}
            </button>
          </form>
          </>}

          {checkingActive && <p role="status" className="mt-4 text-caption text-muted">Checking whether you already have an active experiment…</p>}

          {error && <div role="alert" className="mt-6 rounded-card bg-clay-tint p-5 text-clay">
            <p className="font-medium">{error.stage === "active-check" ? "Couldn’t check for an active experiment." : error.status === 503 ? "The service is unavailable right now." : error.status === 502 ? "We couldn’t put together a complete plan." : error.status === 409 ? "Your profile needs to be saved first." : error.status === 422 ? "Let’s adjust that question." : "Your question hasn’t been submitted successfully."}</p>
            <p className="mt-2">{error.message}</p>
            {error.stage === "proposal" && error.status === 409 ? <Link href="/onboarding" className={`${secondary} mt-4 inline-flex items-center text-ink`}>Go to your rhythm</Link> : <button type="button" onClick={() => void submit()} className={`${secondary} mt-4 text-ink`}>Retry</button>}
          </div>}

          {activeExperiment && startError && !result && <div role="alert" className="mt-6 rounded-card bg-clay-tint p-5 text-clay">
            <p>{startError}</p>
            <Link href={`/experiments/${encodeURIComponent(activeExperiment.id)}`} className="mt-3 inline-flex min-h-11 items-center underline">
              Go to your active experiment
            </Link>
          </div>}

          {busy && !checkingActive && <ProposalSkeleton />}
      {result && !result.safety.allowed && <section ref={output} tabIndex={-1} aria-label="Question result" className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
            <>
              <p className="font-display text-title">Let&apos;s find a gentler experiment.</p>
              <p className="mt-3 text-muted">{result.safety.reason || "This question isn’t suitable for a small habit experiment."}</p>
              {result.safety.suggested_alternative && <div className="mt-5 border-t border-line pt-5"><p>{result.safety.suggested_alternative}</p><button type="button" className={`${secondary} mt-4`} onClick={() => chooseQuestion(result.safety.suggested_alternative!)}>Use this instead</button></div>}
            </>
      </section>}
      {result?.safety.allowed && result.proposal && result.prediction && (
        <div ref={output as React.RefObject<HTMLDivElement>} tabIndex={-1}>
          <ProposalPreview
            result={result}
            onStart={() => void beginExperiment()}
            onAskSomethingElse={() => chooseQuestion("")}
            starting={starting}
            startDisabled={Boolean(activeExperiment)}
          />
          {startError && (
            <div role="alert" className="mt-4 rounded-card bg-clay-tint p-5 text-clay">
              <p>{startError}</p>
              {activeExperiment ? (
                <Link href={`/experiments/${encodeURIComponent(activeExperiment.id)}`} className="mt-3 inline-flex min-h-11 items-center underline">
                  Go to your active experiment
                </Link>
              ) : (
                <button type="button" className={`${secondary} mt-3 text-ink`} onClick={() => void beginExperiment()}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}
        </div>
        {!result?.safety.allowed && <aside className="lg:pt-2">
          <div className="rounded-card bg-moss-tint p-6">
            <p className="font-display text-title">Start with a hunch</p>
            <p className="mt-2 text-caption text-muted">Inspired by your goals and everyday questions. Pick one, then make it yours.</p>
            <ul className="mt-5 divide-y divide-moss/20">{starters(profile).map((starter) => <li key={starter}><button disabled={busy} type="button" onClick={() => chooseQuestion(starter)} className="min-h-11 w-full py-4 text-left text-body text-ink hover:text-moss disabled:opacity-50">{starter}<span aria-hidden="true" className="ml-2 text-moss">↗</span></button></li>)}</ul>
          </div>
          <p className="mt-5 px-1 text-caption text-muted">First a plan. Then a prediction. You decide whether to begin.</p>
        </aside>}
      </div>
    </div>
  );
}
