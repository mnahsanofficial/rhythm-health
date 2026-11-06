"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ProposeResponse } from "@/lib/types/api";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { signedPercent } from "@/lib/report/copy";
import { button } from "@/components/ui/button";
import { GuessBar, PlanRange, PlanRing } from "./plan-visuals";

type Step = "change" | "guess" | "reveal" | "days";
const parse = (text: string) => {
  const normalized = text.trim().replace(",", ".");
  const value = Number(normalized);
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) && Number.isFinite(value) && value >= -100 && value <= 200 ? value : null;
};

export function PlanSteps({ result, guess, onGuess, onStart, onAskSomethingElse, starting, headingLevel }: {
  result: ProposeResponse; guess: number | null; onGuess: (value: number) => void; onStart: () => void;
  onAskSomethingElse: () => void; starting: boolean; headingLevel: 1 | 2;
}) {
  const [step, setStep] = useState<Step>("change");
  const [draft, setDraft] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => { heading.current?.focus(); }, [step]);
  const proposal = result.proposal!, prediction = result.prediction!;
  const metric = proposal.metrics.find(item => item.key === prediction.target_metric) ?? proposal.metrics[0];
  const metricName = metric.short_label?.trim() || "Your main measure";
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const value = parse(draft);
  const total = proposal.baseline_days + proposal.intervention_days;
  const steps: Step[] = result.personal_guess_available ? ["change", "guess", "reveal", "days"] : ["change", "reveal", "days"];
  const title = step === "change" ? proposal.intervention.change_short || "Your small change."
    : step === "guess" ? "Your guess." : step === "reveal" ? "The prediction." : `Your ${total} days.`;
  const next = () => setStep(step === "change" && guess !== null ? "reveal" : steps[steps.indexOf(step) + 1]);
  const back = () => setStep(step === "reveal" ? "change" : steps[steps.indexOf(step) - 1]);
  const details = (label: string, children: ReactNode) => <details className="mt-5 border-t border-line pt-2"><summary className="flex min-h-11 cursor-pointer items-center justify-between font-medium">{label}<span aria-hidden="true">⌄</span></summary><div className="mt-2 space-y-3 pb-3">{children}</div></details>;
  return <section aria-label="Experiment and prediction preview" className="mx-auto max-w-[70rem]">
    <div className="mb-6 flex flex-wrap justify-between gap-3 border-b border-line pb-4 text-caption"><p>{step === "change" ? "The change" : step === "guess" ? "Before the AI has its say" : step === "reveal" ? "A forecast, not a promise" : "A little evidence each day"}</p><p>Step {steps.indexOf(step) + 1} of {steps.length}</p></div>
    <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : MOTION_DURATION.step, ease: MOTION_EASE.settle }}>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          <Heading ref={heading} tabIndex={-1} className="font-display text-headline tracking-tight outline-none sm:text-display-sm">{title}</Heading>
          {step === "change" && <>
            <p className="mt-4 text-lead">{proposal.intervention.change_short ? "One small change, fitted around your day." : proposal.intervention.action}</p>
            {details("Details", <><p>{proposal.intervention.action}</p><p>{proposal.question}</p><p>{proposal.hypothesis}</p><p>When: {proposal.intervention.timing}</p><p>How often: {proposal.intervention.frequency}</p></>)}
            {result.classification.risk === "review" && details("A note before you begin", <p role="note">{result.safety.reason}</p>)}
            <button type="button" disabled={starting} onClick={onAskSomethingElse} className="mt-5 min-h-11 underline">Ask something else</button>
          </>}
          {step === "guess" && <>
            <p className="mt-4 text-lead">How might {metricName.toLowerCase()} change from your normal days?</p>
            <form className="mt-6" onSubmit={event => { event.preventDefault(); if (value !== null) { onGuess(value); setStep("reveal"); } }}>
              <label htmlFor="personal-guess" className="font-medium">Your guess for {metricName}</label>
              <p id="guess-help" className="mt-2">Negative means down, 0 means no change, positive means up. Choose between -100 and +200 percent.</p>
              <div className="mt-4 flex max-w-xs items-center gap-3"><input id="personal-guess" type="text" inputMode="text" autoComplete="off" aria-describedby="guess-help guess-lock" value={draft} onChange={event => setDraft(event.target.value)} className="min-h-12 min-w-0 w-full rounded-control border border-control bg-paper px-4 text-lead text-ink" /><span aria-hidden="true">%</span></div>
              <p role="status" className="mt-4 font-mono text-title tabular-nums lg:sr-only">{value === null ? "Your estimate comes first." : signedPercent(value, 2)}</p><div className="lg:hidden"><GuessBar value={value} /></div>
              <p id="guess-lock" className="mt-4 text-caption">Your guess locks when you reveal the prediction.</p>
              <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={back} className={button("secondary")}>Back</button><button type="submit" disabled={value === null} className={button("primary")}>Show prediction</button></div>
            </form>
          </>}
          {step === "reveal" && <>
            <p className="mt-4 text-lead">{metricName} is {prediction.direction === "increase" ? "likely to go up" : prediction.direction === "decrease" ? "likely to go down" : "likely to stay about the same"}.</p>
            <p className="mt-5">The original forecast</p>
            <p className="mt-2 font-mono text-headline tabular-nums">{signedPercent(prediction.expected_change_min, 2)} to {signedPercent(prediction.expected_change_max, 2)}</p>
            <p className="mt-3 text-caption">Confidence: <span className="capitalize">{prediction.confidence}</span></p>
            {guess !== null ? <p className="mt-5">Your guess: <span className="font-mono tabular-nums">{signedPercent(guess, 2)}</span></p> : <p className="mt-5">Your own guess is unavailable right now. You can still start without one.</p>}
            {details("Why this range", <><p>{prediction.reasoning}</p>{prediction.uncertainty_factors.length > 0 && <><p>What could affect it</p><ul className="list-disc space-y-2 pl-5">{prediction.uncertainty_factors.map(item => <li key={item}>{item}</li>)}</ul></>}</>)}
          </>}
          {step === "days" && <>
            <p className="mt-4 text-lead">We&apos;ll compare your {proposal.baseline_days} normal days with your {proposal.intervention_days} test days. Your check-ins decide, not the AI.</p><p className="mt-3 text-caption">This plan and prediction become fixed once you start.</p>{guess !== null && <p className="mt-4">Your locked guess: <span className="font-mono tabular-nums">{signedPercent(guess, 2)}</span></p>}
            <dl className="mt-6 divide-y divide-line border-y border-line"><div className="py-4"><dt className="font-medium">Normal days</dt><dd className="mt-1">Keep your usual routine. Record {metricName.toLowerCase()}.</dd></div><div className="py-4"><dt className="font-medium">Test days</dt><dd className="mt-1">{proposal.intervention.change_short || proposal.intervention.action}</dd></div><div className="py-4"><dt className="font-medium">Each check-in</dt><dd className="mt-1">A few answers, about 30 seconds.</dd></div></dl>
            {details("What you’ll record", <ul className="space-y-2">{proposal.metrics.map(item => <li key={item.key}>{item.short_label || item.label}{item.primary ? " · Main measure" : ""}</li>)}</ul>)}
          </>}
        </div>
        <aside className={step === "guess" ? "hidden min-w-0 lg:block" : "min-w-0"} aria-label={step === "guess" ? "Your estimate" : step === "reveal" ? "Prediction and guess" : "Your experiment plan"}>
          {step === "guess" ? <div className="rounded-card border border-line bg-paper p-6 sm:p-8"><p>{metricName}</p><p className="mt-4 font-mono text-display-sm tabular-nums">{value === null ? "—" : signedPercent(value, 2)}</p><p className="mt-3">{value === null ? "Your estimate comes first." : value === 0 ? "No change from normal days" : `${value < 0 ? "Lower" : "Higher"} than normal days`}</p><GuessBar value={value} /></div>
            : step === "reveal" ? <div className="rounded-card border border-line bg-paper p-6 sm:p-8"><p className="font-medium">Two expectations, one experiment.</p><PlanRange min={prediction.expected_change_min} max={prediction.expected_change_max} guess={guess} /><p className="mt-6">Your report will compare these with your own check-ins.</p></div>
            : <><PlanRing normal={proposal.baseline_days} test={proposal.intervention_days} />{step === "days" && <ol aria-label="Planned days" className="mt-5 grid grid-cols-5 gap-2">{Array.from({ length: total }, (_, i) => <li key={i} className="rounded-control border border-line px-2 py-3 text-center"><span className="font-mono tabular-nums">{i + 1}</span><span className="mt-1 block text-caption">{i < proposal.baseline_days ? "Normal" : "Test"}</span></li>)}</ol>}<p className="mt-4 text-caption">{proposal.baseline_days} normal days · {proposal.intervention_days} test days{step === "days" ? " · Planned, not recorded" : ""}</p></>}
        </aside>
      </div>
      {step !== "guess" && <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {step !== "change" ? <button type="button" disabled={starting} onClick={back} className={button("secondary")}>Back</button> : <span />}
        <button type="button" disabled={starting} onClick={step === "days" ? onStart : next} className={button("primary")}>{step === "days" ? starting ? "Starting…" : "Start this experiment" : "Next"}</button>
      </div>}
    </motion.div>
  </section>;
}
