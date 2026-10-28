"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { proposeExperiment } from "@/lib/data/experiments";
import { getProfile } from "@/lib/data/profile";
import type { Profile, ProposeResponse } from "@/lib/types/api";

const primary = "min-h-12 rounded-pill bg-moss px-6 py-3 font-medium text-paper hover:bg-moss-deep disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "min-h-11 rounded-pill border border-line bg-paper px-5 py-2 font-medium hover:border-moss";

function starters(profile: Profile): string[] {
  const questions = profile.goals.slice(0, 2).map((goal) => `What small daily habit could help me with ${goal.replace(/[.!?]+$/, "").toLowerCase()}?`);
  return [...new Set([...questions,
    "Does walking after dinner improve my sleep?",
    "Does less caffeine improve my focus?",
    "Does waking earlier actually improve my productivity?",
  ])].filter((q) => q.length <= 500);
}

function ProposalSkeleton() {
  return (
    <section aria-label="Preparing your experiment" className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
      <p role="status" className="text-lead font-medium">Finding a small change you can test…</p>
      <p className="mt-2 text-muted">We&apos;re checking your question, shaping a plan around your rhythm, and estimating what might change. This can take a little while.</p>
      <div aria-hidden="true" className="mt-7 space-y-5 motion-safe:animate-pulse">
        <div className="h-8 w-3/4 rounded bg-line" />
        <div className="h-16 rounded bg-oat" />
        <div className="grid grid-cols-2 gap-3"><div className="h-24 rounded bg-oat" /><div className="h-24 rounded bg-moss-tint" /></div>
        <div className="h-24 rounded bg-oat" />
      </div>
    </section>
  );
}

export function NewExperiment() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
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
  }, [result]);

  async function submit() {
    const text = question.trim();
    if (inFlight.current || text.length < 5 || text.length > 500) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await proposeExperiment(text);
      if (response.safety.allowed && (!response.proposal || !response.prediction)) {
        throw new ApiError(502, "The plan came back incomplete. Please retry.");
      }
      setResult(response);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401) router.replace("/sign-in?next=/experiments/new");
      setError({ status, message: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function chooseQuestion(value: string) {
    setQuestion(value);
    setResult(null);
    setError(null);
    input.current?.focus();
  }

  const profile = session && loaded?.userId === session.user.id ? loaded.profile : null;
  if (loading || !session || !profile) {
    return <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      {profileError ? <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
        <p>Couldn&apos;t load your rhythm: {profileError}</p>
        <button className={`${secondary} mt-4 text-ink`} onClick={() => { setProfileError(null); setAttempt((n) => n + 1); }}>Try again</button>
      </div> : <div role="status"><span className="sr-only">Loading your rhythm</span><div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse"><div className="h-12 w-3/4 rounded bg-line" /><div className="h-56 rounded-card bg-paper" /><div className="h-32 rounded-card bg-paper" /></div></div>}
    </div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-8 pb-16 sm:px-8 sm:pt-14">
      <Link href="/" className="inline-flex min-h-11 items-center text-moss hover:underline">← Your lab</Link>
      <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_280px] lg:gap-14">
        <div className="min-w-0">
          <p className="font-mono text-caption text-moss">A little curiosity, a little evidence</p>
          <h1 className="mt-3 font-display text-display-sm tracking-tight sm:text-display">Ask a question.</h1>
          <p className="mt-4 text-lead text-muted">What have you been wondering about your daily habits? Let&apos;s turn it into something you can test.</p>
          <form className="mt-8" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label htmlFor="question" className="block font-medium">Your question or goal</label>
            <textarea ref={input} id="question" required minLength={5} maxLength={500} disabled={busy} value={question}
              onChange={(event) => { setQuestion(event.target.value); setError(null); setResult(null); }}
              aria-describedby="question-help question-count" rows={4}
              placeholder="Does walking after dinner improve my sleep?"
              className="mt-3 w-full resize-y rounded-card border border-line bg-paper p-4 text-body placeholder:text-muted disabled:opacity-70" />
            <div className="mt-2 flex justify-between gap-4 text-caption text-muted"><p id="question-help">5–500 characters. One small change at a time.</p><span id="question-count" className="font-mono">{question.length}/500</span></div>
            <button type="submit" disabled={busy || question.trim().length < 5 || !!result?.safety.allowed} className={`${primary} mt-5 w-full sm:w-auto`}>{busy ? "Shaping your experiment…" : "Design my experiment"}</button>
          </form>

          {error && <div role="alert" className="mt-6 rounded-card bg-clay-tint p-5 text-clay">
            <p className="font-medium">{error.status === 503 ? "The service is unavailable right now." : error.status === 502 ? "We couldn’t put together a complete plan." : error.status === 409 ? "Your profile needs to be saved first." : error.status === 422 ? "Let’s adjust that question." : "Your question hasn’t been submitted successfully."}</p>
            <p className="mt-2">{error.message}</p>
            {error.status === 409 ? <Link href="/onboarding" className={`${secondary} mt-4 inline-flex items-center text-ink`}>Go to your rhythm</Link> : <button type="button" onClick={() => void submit()} className={`${secondary} mt-4 text-ink`}>Retry</button>}
          </div>}

          {busy && <ProposalSkeleton />}
          {result && <section ref={output} tabIndex={-1} aria-label="Question result" className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
            {!result.safety.allowed ? <>
              <p className="font-display text-title">Let&apos;s find a gentler experiment.</p>
              <p className="mt-3 text-muted">{result.safety.reason || "This question isn’t suitable for a small habit experiment."}</p>
              {result.safety.suggested_alternative && <div className="mt-5 border-t border-line pt-5"><p>{result.safety.suggested_alternative}</p><button type="button" className={`${secondary} mt-4`} onClick={() => chooseQuestion(result.safety.suggested_alternative!)}>Use this instead</button></div>}
            </> : <>
              {result.classification.risk === "review" && <div role="note" className="mb-5 rounded-xl bg-clay-tint p-4 text-clay"><p className="font-medium">Before you test this</p><p className="mt-1">{result.safety.reason || "Treat this experiment with care and keep the change small."}</p></div>}
              <p className="font-mono text-caption text-moss">Your proposed question</p>
              <h2 className="mt-3 font-display text-headline">{result.proposal?.question}</h2>
              <p className="mt-4 text-muted">{result.proposal?.hypothesis}</p>
              <p className="mt-5 border-t border-line pt-5 text-caption text-muted">Nothing has started or been saved. The full plan and prediction preview are the next part of this flow.</p>
              <button type="button" className={`${secondary} mt-4`} onClick={() => chooseQuestion(question)}>Ask something else</button>
            </>}
          </section>}
        </div>
        <aside className="lg:pt-2">
          <div className="rounded-card bg-moss-tint p-6">
            <p className="font-display text-title">Start with a hunch</p>
            <p className="mt-2 text-caption text-muted">Inspired by your goals and everyday questions. Pick one, then make it yours.</p>
            <ul className="mt-5 divide-y divide-moss/20">{starters(profile).map((starter) => <li key={starter}><button disabled={busy} type="button" onClick={() => chooseQuestion(starter)} className="min-h-11 w-full py-4 text-left text-body text-ink hover:text-moss disabled:opacity-50">{starter}<span aria-hidden="true" className="ml-2 text-moss">↗</span></button></li>)}</ul>
          </div>
          <p className="mt-5 px-1 text-caption text-muted">First a plan. Then a prediction. You decide whether to begin.</p>
        </aside>
      </div>
    </div>
  );
}
