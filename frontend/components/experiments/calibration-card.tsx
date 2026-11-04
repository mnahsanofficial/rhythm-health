"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getCalibration } from "@/lib/data/experiments";
import { signedPercent } from "@/lib/report/copy";
import type { Calibration } from "@/lib/types/api";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; calibration: Calibration }
  | { kind: "error"; message: string };

const TREND = {
  closer: "Your guesses are getting closer.",
  further: "Your recent guesses were further off.",
  steady: "Your guesses are staying about as close.",
} as const;

const points = (value: number) => `${value} ${value === 1 ? "point" : "points"}`;

/** Own guess against what happened. The backend works out every number here, with no AI call. */
export function CalibrationCard() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCalibration()
      .then((calibration) => {
        if (!cancelled) setLoad({ kind: "ready", calibration });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Couldn't load this. Try again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <section aria-labelledby="calibration-heading" className="mt-8 rounded-card border border-line bg-paper p-5 sm:p-7">
      <h2 id="calibration-heading" className="font-display text-title">How close your guesses were</h2>
      {load.kind === "loading" && <p role="status" className="mt-3 text-body text-muted">Checking your guesses…</p>}
      {load.kind === "error" && (
        <div role="alert" className="mt-3">
          <p className="text-body text-clay">Couldn&apos;t compare your guesses. {load.message}</p>
          <button
            type="button"
            onClick={() => {
              setLoad({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="mt-2 inline-flex min-h-11 items-center rounded-pill px-3 text-body font-medium text-moss underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
      {load.kind === "ready" && <CalibrationResult calibration={load.calibration} />}
    </section>
  );
}

function CalibrationResult({ calibration }: { calibration: Calibration }) {
  const { points: guesses, average_off_by_points: average, trend, example } = calibration;
  if (guesses.length === 0) {
    return (
      <>
        <p className="mt-3 text-body text-muted">
          Your next experiment asks for your own guess before the forecast, so you can see how close you get.
        </p>
        {example && <ExampleGuess example={example} />}
      </>
    );
  }
  const newestFirst = [...guesses].reverse();
  return (
    <>
      <p className="mt-3 text-lead font-medium">
        {trend ? TREND[trend] : "Finish another experiment to see whether you're getting closer."}
      </p>
      {trend && average !== null && (
        <p className="mt-2 text-body text-muted">
          Off by {points(average)} on average across {guesses.length} experiments. A few short experiments show a pattern, not proof.
        </p>
      )}
      <ol aria-label="Your guesses" className="mt-5 divide-y divide-line border-t border-line">
        {newestFirst.map((guess) => (
          <li key={guess.experiment_id} className="py-4">
            <p className="font-medium">{guess.question}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-caption text-muted tabular-nums">
              <span>You guessed {signedPercent(guess.guessed_change_percent, 2)}</span>
              <span>It changed {signedPercent(guess.observed_change_percent, 2)}</span>
              <span className="text-ink">Off by {points(guess.off_by_points)}</span>
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The demo sample. Never one of the person's guesses, so it says so and sits apart from them. */
function ExampleGuess({ example }: { example: NonNullable<Calibration["example"]> }) {
  return (
    <div role="group" aria-label="Example, not your results" className="mt-5 border-t border-line pt-4">
      <span className="inline-block rounded-pill bg-line px-3 py-1 text-caption text-ink">Example</span>
      <p className="mt-2 text-caption text-muted">Built from invented check-ins. It isn&apos;t part of your results.</p>
      <p className="mt-3 font-medium">{example.question}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-caption text-muted tabular-nums">
        <span>Guessed {signedPercent(example.guessed_change_percent, 2)}</span>
        <span>It changed {signedPercent(example.observed_change_percent, 2)}</span>
        <span className="text-ink">Off by {points(example.off_by_points)}</span>
      </p>
    </div>
  );
}
