"use client";

import { useState } from "react";
import type { ExperimentProposal } from "@rhythm-health/contract";

/** Mount before the forecast so the first guess cannot be anchored by the AI range. */
export function PersonalGuess({ proposal, onReveal, onBack, headingLevel }: {
  proposal: ExperimentProposal;
  headingLevel: 1 | 2;
  onReveal: (guess: number) => void;
  onBack: () => void;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const [answer, setAnswer] = useState("");
  const metric = proposal.metrics.find((item) => item.primary)!;
  const normalized = answer.trim().replace(",", ".");
  const value = Number(normalized);
  const valid = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)
    && Number.isFinite(value) && value >= -100 && value <= 200;

  return (
    <section aria-labelledby="guess-heading" className="mt-6 max-w-2xl border-t-2 border-moss pt-6">
      <p className="text-caption font-medium text-moss">Before the AI has its say</p>
      <Heading id="guess-heading" className="mt-2 font-display text-headline">What do you think will happen?</Heading>
      <p className="mt-4 text-lead">{proposal.question}</p>
      <p className="mt-3 text-muted">The small change: {proposal.intervention.action}</p>
      <form className="mt-7" onSubmit={(event) => {
        event.preventDefault();
        if (valid) onReveal(value);
      }}>
        <label htmlFor="personal-guess" className="block font-medium">Your guess for {metric.label}</label>
        <p id="guess-help" className="mt-2 text-body text-muted">
          Percent change from your normal days. Negative means down, 0 means no change, positive means up.
          For example, +10 means 10% higher. Choose between -100 and +200.
        </p>
        <div className="mt-3 flex max-w-xs items-center gap-3">
          <input
            id="personal-guess"
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-describedby="guess-help guess-frozen"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="min-h-12 min-w-0 w-full rounded-card border border-line bg-paper px-4 text-lead"
          />
          <span aria-hidden="true" className="font-mono text-title">%</span>
        </div>
        <p id="guess-frozen" className="mt-4 text-caption text-muted">
          Your guess locks when you reveal the AI prediction. It is saved if you start the experiment, so your report can compare both with what happens.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={!valid}
            className="min-h-12 rounded-pill bg-moss px-6 py-3 font-medium text-paper hover:bg-moss-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal the AI prediction
          </button>
          <button type="button" onClick={onBack} className="min-h-11 rounded-pill border border-line px-5 py-2 font-medium">
            Ask something else
          </button>
        </div>
      </form>
    </section>
  );
}
