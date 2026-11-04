"use client";

import { ForecastCard } from "@/components/experiments/forecast-card";
import { button } from "@/components/ui/button";
import type { ProposeResponse } from "@/lib/types/api";

const primary = button("primary");
const secondary = button("secondary");

export function ProposalPreview({ result, onStart, onAskSomethingElse, starting, headingLevel }: {
  result: ProposeResponse;
  onStart: () => void;
  onAskSomethingElse: () => void;
  starting: boolean;
  headingLevel: 1 | 2;
}) {
  const proposal = result.proposal;
  const prediction = result.prediction;
  if (!proposal || !prediction) return null;
  const Heading = headingLevel === 1 ? "h1" : "h2";
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
      <Heading className="mt-2 max-w-4xl font-display text-headline tracking-tight sm:text-display-sm">{proposal.question}</Heading>

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
        <button type="button" onClick={onStart} disabled={starting} className={primary}>
          {starting ? "Saving your experiment…" : "Start this experiment"}
        </button>
        <button type="button" onClick={onAskSomethingElse} disabled={starting} className={secondary}>
          Ask something else
        </button>
      </div>
    </section>
  );
}
