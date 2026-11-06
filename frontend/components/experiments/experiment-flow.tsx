"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getExperiment, isActiveLimitReached, proposeExperiment, saveExperiment, startExperiment } from "@/lib/data/experiments";
import type { Profile, ProposeResponse } from "@rhythm-health/contract";
import { closeButton, CloseIcon } from "@/components/nav/close-icon";
import { useLeaveGuard, useNav } from "@/components/nav/navigation";
import { PlanSteps } from "@/components/experiments/plan-steps";
import { ProposalSkeleton } from "@/components/experiments/proposal-skeleton";
import { starters } from "@/components/experiments/starters";
import { WONT_BE_KEPT } from "@/lib/nav/routes";
import { QuestionForm } from "@/components/experiments/question-form";
import { QuestionResult } from "@/components/experiments/question-result";
import { button } from "@/components/ui/button";

const secondary = button("secondary");

/** A 409 can mean an earlier start landed and only its response was lost, so read before reporting. */
async function alreadyStarted(id: string) {
  try {
    return (await getExperiment(id)).status === "active";
  } catch {
    return false;
  }
}

/** Shared entry, proposal, save and start flow; the host page owns auth/profile loading. */
export function ExperimentFlow({
  profile,
  initialQuestion = "",
  returnTo = "/experiments/new",
  headingLevel = 1,
  showStarters = true,
  onReloadLab,
  closable = false,
}: {
  profile: Profile;
  initialQuestion?: string;
  returnTo?: "/" | "/experiments/new";
  headingLevel?: 1 | 2;
  showStarters?: boolean;
  /** Set when already on Your lab, where a link to it would do nothing. */
  onReloadLab?: () => void;
  /** Set when the question is Your lab itself: once there's a proposal, a × clears it. */
  closable?: boolean;
}) {
  const router = useRouter();
  const { confirm } = useNav();
  const [question, setQuestion] = useState(
    initialQuestion.length >= 5 && initialQuestion.length <= 500 ? initialQuestion : "",
  );
  const [personalGuess, setPersonalGuess] = useState<number | null>(null);
  const [guessUnavailable, setGuessUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [continued, setContinued] = useState(false);
  const continuing = useRef(false); // The person chose Continue anyway for this question, so a retry mustn't ask again.
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [error, setError] = useState<{
    status: number;
    message: string;
  } | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startAtLimit, setStartAtLimit] = useState(false);
  const [savedExperimentId, setSavedExperimentId] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const output = useRef<HTMLElement>(null);
  const hasShownResult = useRef(false);
  const typed = question.trim() !== "" && question !== initialQuestion;
  const unsaved = starting || savedExperimentId ? null : result?.proposal ? WONT_BE_KEPT.proposal : typed ? WONT_BE_KEPT.question : null;
  useLeaveGuard(unsaved);

  const labLink = onReloadLab
    ? <button type="button" onClick={onReloadLab} className="mt-3 mr-4 inline-flex min-h-11 items-center underline">Go to your lab</button>
    : <Link href="/" className="mt-3 mr-4 inline-flex min-h-11 items-center underline">Go to your lab</Link>;

  useEffect(() => {
    if (result && !(result.safety.allowed && result.proposal && result.prediction)) output.current?.focus();
    else if (hasShownResult.current) input.current?.focus();
    hasShownResult.current = Boolean(result);
  }, [result]);

  async function submit(continueAnyway = false) {
    const text = question.trim();
    if (inFlight.current || limitMessage || result?.safety.allowed === false || text.length < 5 || text.length > 500) return;
    inFlight.current = true;
    continuing.current = continueAnyway;
    setContinued(continueAnyway);
    setBusy(true);
    setError(null);
    setStartError(null);
    setStartAtLimit(false);
    setResult(null);
    setPersonalGuess(null);
    setGuessUnavailable(false);
    try {
      const response = await proposeExperiment(text, continueAnyway);
      if (response.safety.allowed && !response.habit_check && (!response.proposal || !response.prediction)) {
        throw new ApiError(502, "The plan came back incomplete. Please retry.");
      }
      if (!response.safety.allowed && !response.safety.suggested_question) setQuestion("");
      setResult(response);
    } catch (e) {
      if (isActiveLimitReached(e)) {
        setLimitMessage(e.message);
        return;
      }
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401) router.replace(`/sign-in?next=${returnTo}`);
      setError({
        status,
        message: e instanceof Error ? e.message : "Couldn't finish that. Try again.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function chooseQuestion(value: string) {
    continuing.current = false;
    setContinued(false);
    setQuestion(value);
    setPersonalGuess(null);
    setGuessUnavailable(false);
    setResult(null);
    setError(null);
    setStartError(null);
    setSavedExperimentId(null);
    setStartAtLimit(false);
    setLimitMessage(null);
    input.current?.focus();
  }

  async function beginExperiment(withoutGuess = false) {
    if (!result?.proposal || !result.prediction || inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setGuessUnavailable(false);
    setStartError(null);
    setStartAtLimit(false);
    let experimentId = savedExperimentId;
    try {
      if (!experimentId) {
        const saved = await saveExperiment({
          proposal: result.proposal,
          prediction: result.prediction,
          category: result.classification.category,
          ...(personalGuess !== null && !withoutGuess ? { personal_guess_percent: personalGuess } : {}),
        });
        experimentId = saved.id;
        setSavedExperimentId(saved.id);
      }
      const active = await startExperiment(experimentId);
      router.push(`/experiments/${encodeURIComponent(active.id)}`);
    } catch (cause) {
      if (cause instanceof ApiError && typeof cause.detail === "object" && cause.detail !== null
        && "code" in cause.detail && cause.detail.code === "personal_guess_unavailable") {
        setGuessUnavailable(true);
        setStartError(cause.message);
        return;
      }
      if (experimentId) {
        setSavedExperimentId(experimentId);
        if (isActiveLimitReached(cause)) {
          setStartAtLimit(true);
          setStartError(`Your experiment was saved, but it couldn’t start yet. ${cause.message}`);
        } else if (cause instanceof ApiError && cause.status === 409 && await alreadyStarted(experimentId)) {
          router.push(`/experiments/${encodeURIComponent(experimentId)}`);
        } else {
          setStartError(`Your experiment was saved, but it couldn’t be started: ${cause instanceof Error ? cause.message : "Try again."}`);
        }
      } else {
        setStartError(cause instanceof Error ? cause.message : "Couldn't save your experiment. Try again.");
      }
    } finally {
      inFlight.current = false;
      setStarting(false);
    }
  }

  return (
    <div>
      {closable && result?.proposal && (
        <div className="-mb-3 flex justify-end">
          <button type="button" aria-label="Close" onClick={() => confirm(() => chooseQuestion(""), WONT_BE_KEPT.proposal)} className={closeButton}>
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="mt-5 grid gap-10">
        <div className="min-w-0">
          {!busy && (!result?.safety.allowed || result.habit_check) && <>
          <QuestionForm
            inputRef={input}
            question={question}
            onChange={(value) => {
              continuing.current = false;
              setContinued(false);
              setQuestion(value);
              setError(null);
              setResult(null);
              setStartError(null);
              setStartAtLimit(false);
              setLimitMessage(null);
            }}
            onSubmit={() => void submit()}
            busy={busy}
            blocked={Boolean(limitMessage) || result?.safety.allowed === false || Boolean(result?.habit_check)}
            hideSubmit={Boolean(result?.habit_check)}
            headingLevel={headingLevel}
            suggestions={showStarters && !result ? starters(profile) : []}
            onSuggestion={chooseQuestion}
          />
          </>}

          {error && <div role="alert" className="mt-6 rounded-card bg-clay-tint p-5 text-clay">
            <p className="font-medium">{error.status === 503 ? "The service is unavailable right now." : error.status === 502 ? "We couldn’t put together a complete plan." : error.status === 409 ? "Your profile needs to be saved first." : error.status === 422 ? "Let’s adjust that question." : error.status === 429 ? "You’ve reached today’s limit." : "Your question hasn’t been submitted successfully."}</p>
            <p className="mt-2">{error.message}</p>
            {error.status === 409 ? <Link href="/onboarding" className={`${secondary} mt-4 inline-flex items-center text-ink`}>Go to your rhythm</Link> : error.status === 429 ? null : <button type="button" onClick={() => void submit(continuing.current)} className={`${secondary} mt-4 text-ink`}>Retry</button>}
          </div>}

          {limitMessage && !result && (
            <div role="alert" className="mt-6 rounded-card bg-clay-tint p-5 text-clay">
              <p>{limitMessage}</p>
              {labLink}
            </div>
          )}

          {busy && <ProposalSkeleton />}
      {result && (result.habit_check || !result.safety.allowed) && <QuestionResult result={result} headingRef={output}
        onUseSuggestion={chooseQuestion} onContinue={() => void submit(true)} />}
      {result?.safety.allowed && result.proposal && result.prediction && (
        <div ref={output as React.RefObject<HTMLDivElement>} tabIndex={-1}>
          {continued && <p role="note" className="mb-4 border-l-2 border-line pl-4 text-caption text-muted">Your question wasn&apos;t about a habit, so Rhythm suggested a related habit experiment instead.</p>}
          <PlanSteps result={result} guess={personalGuess} onGuess={setPersonalGuess} headingLevel={headingLevel}
            onStart={() => void beginExperiment()} onAskSomethingElse={() => chooseQuestion("")} starting={starting} />
          {startError && (
            <div role="alert" className="mt-4 rounded-card bg-clay-tint p-5 text-clay">
              <p>{startError}</p>
              {guessUnavailable && (
                <button type="button" className={`${secondary} mt-3 text-ink`} disabled={starting} onClick={() => void beginExperiment(true)}>
                  Continue without saving my guess
                </button>
              )}
              {startAtLimit && labLink}
              <button type="button" className={`${secondary} mt-3 text-ink`} onClick={() => void beginExperiment()}>
                Try again
              </button>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
