"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { RhythmSummary } from "@/components/onboarding/rhythm-summary";
import { nightIsPlausible, QUESTION_COUNT, STEPS } from "@/components/onboarding/steps";
import { RhythmRing } from "@/components/rhythm-ring";
import { useSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/profile";
import { draftFromProfile, loadDraft, saveDraft, type OnboardingDraft } from "@/lib/onboarding/draft";
import { placeHabits } from "@/lib/rhythm/habits";

// Steps slide in the direction you're going, so back and forward feel different.
const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }),
};

const noSubscribe = () => () => {};

/** Saved answers live in localStorage, so the flow renders in the browser only; the server sends a skeleton. */
export function OnboardingFlow() {
  const isClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  return isClient ? <Flow /> : <StepSkeleton />;
}

/** After the last question: the rhythm comes together. */
const SUMMARY_STEP = STEPS.length + 1;

/** step 0 is the intro; steps 1..n are STEPS[0..n-1]; then the summary. */
function Flow() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(() => Math.min(loadDraft().step, SUMMARY_STEP));
  // Set when "Change" on the summary sends the user back to one question.
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadDraft().draft);
  const focusNextHeading = useRef(false);
  const formId = useId();

  useEffect(() => {
    saveDraft({ step, draft });
  }, [step, draft]);

  // A returning user with nothing on the device starts from their saved answers, not a blank form.
  const { session } = useSession();
  const [prefillChecked, setPrefillChecked] = useState(false);
  const [prefillFailed, setPrefillFailed] = useState(false);
  useEffect(() => {
    if (!session || prefillChecked || Object.keys(draft).length > 0) return;
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setDraft((d) => (Object.keys(d).length > 0 ? d : draftFromProfile(p)));
      })
      .catch(() => !cancelled && setPrefillFailed(true))
      .finally(() => !cancelled && setPrefillChecked(true));
    return () => {
      cancelled = true;
    };
  }, [session, prefillChecked, draft]);

  // After moving between steps, focus the new heading once it mounts (after the old step
  // has animated out), so keyboard and screen-reader users land on the new question.
  const headingRef = (el: HTMLHeadingElement | null) => {
    if (el && focusNextHeading.current) {
      focusNextHeading.current = false;
      el.focus({ preventScroll: true });
    }
  };

  const go = (to: number) => {
    focusNextHeading.current = true;
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const isSummary = step === SUMMARY_STEP;
  const current = step > 0 && !isSummary ? STEPS[step - 1] : null;
  const answered = current ? current.isAnswered(draft) : true;
  const canContinue = (answered || Boolean(current?.optional)) && step < SUMMARY_STEP;

  const submitStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    if (current?.complete) {
      const patch = current.complete(draft);
      setDraft((d) => ({ ...d, ...patch }));
    }
    if (returnToSummary) {
      setReturnToSummary(false);
      go(SUMMARY_STEP);
    } else {
      go(step + 1);
    }
  };

  return (
    <div
      className={`mx-auto grid w-full max-w-6xl flex-1 px-4 sm:px-8 ${
        isSummary ? "" : "lg:grid-cols-[minmax(0,34rem)_1fr] lg:gap-20"
      }`}
    >
      <div className="flex flex-col">
        <div className="h-6 pt-2">{current && <ProgressBar current={step} total={QUESTION_COUNT} />}</div>
        {prefillFailed && step === 0 && (
          <p role="status" className="mt-4 rounded-card bg-clay-tint p-3 text-body text-clay">
            Couldn&apos;t load your saved answers, so this starts blank. Saving at the end still updates your rhythm.
          </p>
        )}

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={reduce ? undefined : slide}
            initial={reduce ? false : "enter"}
            animate={reduce ? undefined : "center"}
            exit={reduce ? undefined : "exit"}
            className="flex-1 pt-8 pb-6 sm:flex-none sm:pt-12"
          >
            {isSummary ? (
              // Outside any form: the summary holds its own sign-up form, and forms can't nest.
              <RhythmSummary
                draft={draft}
                headingRef={headingRef}
                onEdit={(to) => {
                  setReturnToSummary(true);
                  go(to);
                }}
              />
            ) : (
              <form id={formId} onSubmit={submitStep}>
                {current ? (
                  <>
                    <p className="font-mono text-caption text-moss tabular-nums">
                      {String(step).padStart(2, "0")} / {String(QUESTION_COUNT).padStart(2, "0")}
                    </p>
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className="mt-2 font-display text-headline tracking-tight outline-none"
                    >
                      {current.question}
                    </h1>
                    <p className="mt-2 text-body text-muted">{current.why}</p>
                    <div className="mt-8">
                      <current.Body draft={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
                    </div>
                  </>
                ) : (
                  <Intro headingRef={headingRef} />
                )}
              </form>
            )}
          </motion.div>
        </AnimatePresence>

        <div
          hidden={isSummary}
          className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-line bg-oat/95 px-4 py-4 backdrop-blur sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0"
        >
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="min-h-12 rounded-pill px-5 text-body font-medium text-ink hover:bg-line/60"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            form={formId}
            disabled={!canContinue}
            className="ml-auto min-h-12 rounded-pill bg-moss px-7 text-lead font-medium text-paper transition-[background-color,opacity,scale] hover:bg-moss-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-moss disabled:active:scale-100"
          >
            {step === 0 ? "Start" : returnToSummary ? "Done" : answered ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
      {!isSummary && <RhythmPanel draft={draft} />}
    </div>
  );
}

/** Wide screens: the ring sits beside the questions and fills in as each answer arrives. */
function RhythmPanel({ draft }: { draft: OnboardingDraft }) {
  return (
    <aside aria-label="Your rhythm so far" className="hidden lg:block">
      <div className="sticky top-8 mt-14 rounded-card border border-line bg-paper p-8">
        <p className="text-caption font-medium text-ink">Your rhythm so far</p>
        <div className="mx-auto mt-4 max-w-[340px]">
          <RhythmRing
            schedule={nightIsPlausible(draft) ? draft.usual_sleep_schedule : undefined}
            sleepHours={draft.usual_sleep_hours}
            habits={placeHabits(draft.regular_habits ?? [], draft.usual_sleep_schedule)}
          />
        </div>
        <p className="mt-4 text-caption text-muted">Built from your answers. Nothing is sent until you sign up.</p>
      </div>
    </aside>
  );
}

function Intro({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-display-sm tracking-tight outline-none">
        First, your rhythm.
        <span className="block text-muted">Seven quick questions.</span>
      </h1>
      <ul className="mt-8 flex flex-col gap-4 text-lead">
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-night" />
          When you usually sleep and wake, and how much of that is sleep.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-moss" />
          How much you move, and what you&apos;d like to change.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full border border-ink bg-sun" />
          The habits you already have, like coffee or late dinners.
        </li>
      </ul>
      <p className="mt-8 text-body text-muted">
        Nothing medical, and no weights or calories. Your answers stay on this device until you create an
        account at the end.
      </p>
    </>
  );
}

/** Same shape as a question step, shown while saved answers load. */
function StepSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-xl px-4 pt-10 sm:px-8">
      <div className="h-3 w-16 rounded-pill bg-line" />
      <div className="mt-4 h-8 w-3/4 rounded-pill bg-line" />
      <div className="mt-3 h-4 w-full rounded-pill bg-line" />
      <div className="mt-10 flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 rounded-card bg-line/70" />
        ))}
      </div>
    </div>
  );
}
