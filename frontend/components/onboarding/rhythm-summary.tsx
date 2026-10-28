"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { AuthForm, type AuthMode } from "@/components/auth/auth-form";
import { ACTIVITY_OPTIONS, AGE_OPTIONS } from "@/components/onboarding/steps";
import { RhythmRing } from "@/components/rhythm-ring";
import { useSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";
import { saveProfile } from "@/lib/data/profile";
import { clearDraft, toProfileInput, type OnboardingDraft } from "@/lib/onboarding/draft";
import { placeHabits } from "@/lib/rhythm/habits";
import { formatHours } from "@/lib/rhythm/time";

type Props = {
  draft: OnboardingDraft;
  /** Jump back to a question (1-based step number) to change an answer. */
  onEdit: (step: number) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
};

type SaveState = "idle" | "saving" | "saved" | { error: string };

// The ring draws first (about 1.1s, markers until ~1.5s); the summary follows it in.
const SUMMARY_DELAY = 1.3;

/** End of onboarding: the ring assembles from the answers, then the summary and the save button arrive. */
export function RhythmSummary({ draft, onEdit, headingRef }: Props) {
  const reduce = useReducedMotion();
  const [save, setSave] = useState<SaveState>("idle");
  const { session, loading: sessionLoading } = useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-up");
  const input = toProfileInput(draft);
  const schedule = draft.usual_sleep_schedule;
  const placed = placeHabits(draft.regular_habits ?? [], schedule);
  const unplaced = (draft.regular_habits ?? []).filter((h) => !placed.some((p) => p.label === h));

  const rows = [
    {
      step: 2,
      label: "Sleep",
      value: schedule
        ? `${schedule.bedtime} to ${schedule.wake_time}, about ${formatHours(draft.usual_sleep_hours ?? 0)} h asleep`
        : "Not answered",
    },
    { step: 4, label: "Activity", value: ACTIVITY_OPTIONS.find((o) => o.value === draft.activity_level)?.label },
    { step: 5, label: "Goals", value: draft.goals?.join(", ") },
    { step: 6, label: "Habits", value: draft.regular_habits?.length ? draft.regular_habits.join(", ") : "None picked" },
    { step: 7, label: "Limits", value: draft.constraints?.length ? draft.constraints.join(", ") : "None" },
    { step: 1, label: "Age", value: AGE_OPTIONS.find((o) => o.value === draft.age_range)?.label },
  ];

  const appear = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduce ? 0 : SUMMARY_DELAY + i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  });

  async function handleSave() {
    if (!input) return;
    setSave("saving");
    try {
      await saveProfile(input);
      // Saved on the server, so the on-device copy has done its job.
      clearDraft();
      setSave("saved");
    } catch (e) {
      setSave({
        error:
          e instanceof ApiError && e.status !== 0
            ? `Couldn't save: ${e.message.replace(/\.$/, "")}. Your answers are still here, so try again.`
            : "Couldn't reach the server. Your answers are still here, so try again.",
      });
    }
  }

  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-display-sm tracking-tight outline-none">
        Here&apos;s your rhythm.
        <span className="block text-muted">Your experiments start from here.</span>
      </h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
        <div className="rounded-card border border-line bg-paper p-5 sm:p-8">
          <div className="mx-auto max-w-[340px]">
            <RhythmRing schedule={schedule} sleepHours={draft.usual_sleep_hours} habits={placed} assemble />
          </div>
          {placed.length > 0 && (
            <ul className="mt-6 flex flex-col gap-2 text-body">
              {placed.map((h, i) => (
                <motion.li key={h.label} {...appear(i)} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted">
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-ink bg-sun" />
                    {h.label}
                  </span>
                  <span className="font-mono tabular-nums">{h.time}</span>
                </motion.li>
              ))}
            </ul>
          )}
          {unplaced.length > 0 && (
            <motion.p {...appear(placed.length)} className="mt-3 text-caption text-muted">
              No set time, so not on the ring: {unplaced.join(", ")}.
            </motion.p>
          )}
        </div>

        <div>
          <dl className="divide-y divide-line border-y border-line">
            {rows.map((row, i) => (
              <motion.div key={row.label} {...appear(i)} className="flex items-start gap-4 py-4">
                <dt className="w-20 shrink-0 pt-0.5 text-caption font-medium text-muted">{row.label}</dt>
                <dd className="flex-1 text-body text-ink">{row.value ?? "Not answered"}</dd>
                <button
                  type="button"
                  onClick={() => onEdit(row.step)}
                  aria-label={`Change ${row.label.toLowerCase()}`}
                  className="-my-2 min-h-11 shrink-0 rounded-pill px-3 text-caption font-medium text-moss hover:bg-moss-tint"
                >
                  Change
                </button>
              </motion.div>
            ))}
          </dl>

          <motion.div {...appear(rows.length)} className="mt-8">
            {save === "saved" ? (
              <div role="status" className="rounded-card bg-moss-tint p-5">
                <p className="text-lead font-medium text-ink">Saved.</p>
                <p className="mt-1 text-body text-muted">Your rhythm is in your account. Next, pick something to test.</p>
                <Link
                  href="/"
                  className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-moss px-5 text-body font-medium text-paper hover:bg-moss-deep"
                >
                  Back to home
                </Link>
              </div>
            ) : sessionLoading ? (
              <div aria-hidden="true" className="h-12 w-48 animate-pulse rounded-pill bg-line" />
            ) : !session ? (
              // Answers are kept on the device until there's an account to save them to (TRD §6).
              <div className="rounded-card border border-line bg-paper p-5 sm:p-6">
                <h2 className="font-display text-title tracking-tight">
                  {authMode === "sign-up" ? "Create an account to save it" : "Sign in to save it"}
                </h2>
                <p className="mt-1 mb-5 text-body text-muted">Your answers stay on this device until you do.</p>
                {input ? (
                  <AuthForm mode={authMode} onModeChange={setAuthMode} onSignedIn={handleSave} />
                ) : (
                  <p className="text-body text-muted">A few answers are missing. Use Change to fill them in.</p>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!input || save === "saving"}
                  aria-busy={save === "saving"}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-moss px-7 text-lead font-medium text-paper transition-[background-color,opacity,scale] hover:bg-moss-deep active:scale-[0.98] disabled:opacity-60 sm:w-auto"
                >
                  {save === "saving" ? "Saving…" : "Save my rhythm"}
                </button>
                <p
                  aria-live="polite"
                  className={`mt-3 text-caption ${typeof save === "object" ? "font-medium text-clay" : "text-muted"}`}
                >
                  {typeof save === "object"
                    ? save.error
                    : !input
                      ? "A few answers are missing. Use Change to fill them in."
                      : `Signed in as ${session.user.email}.`}
                </p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
