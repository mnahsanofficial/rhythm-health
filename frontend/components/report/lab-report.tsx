"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DayChart } from "@/components/report/day-chart";
import { PredictionVsReality } from "@/components/report/prediction-vs-reality";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listCheckins } from "@/lib/data/checkins";
import { getExperiment } from "@/lib/data/experiments";
import { getReport } from "@/lib/data/reports";
import { reasonText, SIGNAL_COPY, signedPercent } from "@/lib/report/copy";
import type { Checkin, Experiment, Report, SignalClass } from "@/lib/types/api";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; experiment: Experiment; report: Report | null; checkins: Checkin[] }
  | { kind: "error"; status: number; message: string };

type ReportNarrative = {
  summary: string | null;
  interpretation: string | null;
  personalLearnings: string[];
  confounders: string[];
  nextExperiment: { question: string; reason: string } | null;
};

const SIGNAL_TONE: Record<SignalClass, string> = {
  likely_signal: "bg-moss text-paper",
  possible_signal: "bg-moss-tint text-moss",
  unclear: "bg-line text-ink",
  probably_noise: "bg-oat text-muted border border-line",
};

const linkButton =
  "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-paper transition-[background-color,scale] hover:bg-moss-deep active:scale-[0.98]";

export function LabReport({ id }: { id: string }) {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const path = `/experiments/${encodeURIComponent(id)}`;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(`/sign-in?next=${encodeURIComponent(`${path}/report`)}`);
      return;
    }
    let cancelled = false;
    Promise.all([getExperiment(id), getReport(id), listCheckins(id)])
      .then(([experiment, report, checkins]) => !cancelled && setLoad({ kind: "ready", experiment, report, checkins }))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`/sign-in?next=${encodeURIComponent(`${path}/report`)}`);
          return;
        }
        setLoad({
          kind: "error",
          status: e instanceof ApiError ? e.status : 0,
          message: e instanceof Error ? e.message : "Something went wrong.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, path, session, sessionLoading, router, attempt]);

  if (load.kind === "loading") return <LabReportSkeleton />;

  if (load.kind === "error") {
    return (
      <Page>
        <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
          <h1 className="font-display text-title">
            {load.status === 404 ? "We couldn't find that experiment." : "We couldn't load this report."}
          </h1>
          {load.status !== 404 && <p className="mt-2">{load.message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {load.status !== 404 && (
              <button
                type="button"
                onClick={() => {
                  setLoad({ kind: "loading" });
                  setAttempt((n) => n + 1);
                }}
                className="min-h-11 rounded-pill bg-paper px-5 text-ink"
              >
                Try again
              </button>
            )}
            <Link href="/" className="inline-flex min-h-11 items-center underline">
              Back to your lab
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  const { experiment, report, checkins } = load;

  if (!report) {
    return (
      <Page back={path}>
        <h1 className="font-display text-headline tracking-tight">No results yet.</h1>
        <p className="mt-3 text-lead text-muted">
          {experiment.status === "completed"
            ? "This experiment is finished, but its report isn't available. Try again in a moment."
            : "Results appear once the experiment is finished. Keep checking in, then finish it from the experiment page."}
        </p>
        <Link href={path} className={`${linkButton} mt-8`}>
          Go to your experiment
        </Link>
      </Page>
    );
  }

  const { analysis } = report;
  const narrative = reportNarrative(report);
  const primary = analysis.metrics.find((m) => m.key === analysis.primary_metric) ?? analysis.metrics[0];
  const signal = SIGNAL_COPY[analysis.signal.classification];
  const others = analysis.metrics.filter((m) => m.key !== primary?.key);
  const a = analysis.adherence;
  const completedOn = experiment.completed_at
    ? new Date(experiment.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "long" })
    : null;

  return (
    <Page back={path}>
      <p className="font-mono text-caption text-moss">Lab Report{completedOn ? ` · finished ${completedOn}` : ""}</p>
      <h1 className="mt-2 max-w-4xl font-display text-headline tracking-tight sm:text-display-sm">{experiment.question}</h1>

      <div className="mt-8">
        {analysis.prediction && primary ? (
          <PredictionVsReality comparison={analysis.prediction} metricLabel={primary.label} />
        ) : (
          <section className="rounded-card border border-line bg-paper p-6 sm:p-8">
            <h2 className="font-display text-title">Prediction vs reality</h2>
            <p className="mt-2 text-body text-muted">
              There wasn&apos;t enough data in both phases to compare with the prediction.
            </p>
          </section>
        )}
      </div>

      <section
        aria-labelledby="verdict-heading"
        className="mt-8 border-t border-line pt-7"
      >
        <p className="text-caption text-muted">Signal or noise</p>
        <h2 id="verdict-heading" className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`rounded-pill px-4 py-1.5 font-display text-title ${SIGNAL_TONE[analysis.signal.classification]}`}>
            {signal.label}
          </span>
        </h2>
        <p className="mt-4 text-lead text-ink">{signal.summary}</p>
        {primary && primary.percent_change !== null && (
          <p className="mt-2 text-body text-muted">
            {primary.label}: {signedPercent(primary.percent_change)} on test days compared with your baseline
            {primary.baseline.mean !== null && primary.intervention.mean !== null &&
              ` (${primary.baseline.mean.toFixed(1)} → ${primary.intervention.mean.toFixed(1)} on average)`}
            .
          </p>
        )}
        {analysis.signal.reasons.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
            {analysis.signal.reasons.map((r) => (
              <li key={r} className="flex gap-3 text-body">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted" />
                {reasonText(r, analysis.success_criteria_percent)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-caption text-muted">A short personal experiment shows a pattern, not proof.</p>
      </section>

      <div className="mt-6">
        <section aria-labelledby="adherence-heading" className="rounded-card border border-line bg-paper p-6 sm:p-8">
          <h2 id="adherence-heading" className="font-display text-title">
            How the days went
          </h2>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Stat label="Baseline days logged" value={`${a.baseline_days_logged} of ${a.baseline_days_planned}`} />
            <Stat label="Test days logged" value={`${a.intervention_days_logged} of ${a.intervention_days_planned}`} />
            <Stat label="Made the change, test days" value={`${a.intervention_days_completed} of ${a.intervention_days_logged}`} />
            <Stat
              label="Missed"
              value={
                a.missing_days.length === 0
                  ? "None"
                  : `${a.missing_days.length === 1 ? "Day" : "Days"} ${a.missing_days.join(", ")}`
              }
            />
          </dl>
        </section>
      </div>

      {primary && (
        <div className="mt-6">
          <DayChart experiment={experiment} checkins={checkins} primary={primary} comparison={analysis.prediction} />
        </div>
      )}

      {others.length > 0 && (
        <section aria-labelledby="others-heading" className="mt-6 rounded-card border border-line bg-paper p-6 sm:p-8">
          <h2 id="others-heading" className="font-display text-title">
            The other things you tracked
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {others.map((m) => (
              <li key={m.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span className="text-body">{m.label}</span>
                <span className="font-mono text-body tabular-nums">
                  {m.baseline.mean !== null && m.intervention.mean !== null
                    ? `${m.baseline.mean.toFixed(1)} → ${m.intervention.mean.toFixed(1)}`
                    : "Not enough data"}
                  {m.percent_change !== null && <span className="ml-2 text-muted">{signedPercent(m.percent_change)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-muted">Baseline average → test average. Only the main measure decides the result.</p>
        </section>
      )}

      <section
        aria-labelledby="learning-heading"
        className="mt-6 rounded-card bg-moss-tint p-6 sm:p-8"
      >
        <h2 id="learning-heading" className="font-display text-title">
          What you learned about you
        </h2>
        {narrative.summary ? (
          <p className="mt-3 text-body">{narrative.summary}</p>
        ) : (
          <p className="mt-3 text-body text-muted">
            Waiting for your written results. Takeaways will appear when they are available for this report.
          </p>
        )}
        {narrative.interpretation && (
          <p className="mt-3 text-body text-muted">{narrative.interpretation}</p>
        )}
        {narrative.personalLearnings.length > 0 && (
          <ul className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
            {narrative.personalLearnings.map((learning) => (
              <li key={learning} className="flex gap-3 text-body">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-moss" />
                {learning}
              </li>
            ))}
          </ul>
        )}
        {narrative.confounders.length > 0 && (
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="font-medium">Things that may have shaped the result</h3>
            <ul className="mt-2 flex flex-col gap-2 text-body text-muted">
              {narrative.confounders.map((confounder) => <li key={confounder}>{confounder}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section
        aria-labelledby="next-experiment-heading"
        className="mt-6 rounded-card border border-line bg-paper p-6 sm:p-8"
      >
        <h2 id="next-experiment-heading" className="font-display text-title">
          What to test next
        </h2>
        {narrative.nextExperiment ? (
          <>
            <p className="mt-3 text-lead">{narrative.nextExperiment.question}</p>
            <p className="mt-2 text-body text-muted">{narrative.nextExperiment.reason}</p>
            <Link
              href={`/experiments/new?question=${encodeURIComponent(narrative.nextExperiment.question)}`}
              className={`${linkButton} mt-5`}
            >
              Run this experiment
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-body text-muted">
              Waiting for your follow-up results. A new question will appear when it is available for this report.
            </p>
            <Link href="/experiments/new" className={`${linkButton} mt-5`}>
              Ask a new question
            </Link>
          </>
        )}
      </section>
    </Page>
  );
}

function reportNarrative(report: Report): ReportNarrative {
  const fields = report as unknown as Record<string, unknown>;
  const next = fields.next_experiment;
  const nextExperiment = isRecord(next)
    && typeof next.question === "string"
    && typeof next.reason === "string"
    ? { question: next.question, reason: next.reason }
    : null;

  return {
    summary: typeof fields.summary === "string" ? fields.summary : null,
    interpretation: typeof fields.interpretation === "string" ? fields.interpretation : null,
    personalLearnings: stringList(fields.personal_learnings),
    confounders: stringList(fields.confounders),
    nextExperiment,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lead tabular-nums">{value}</dd>
    </div>
  );
}

function Page({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <div className="page-frame flex-1 pt-8 pb-16 sm:pt-14">
      {back && (
        <Link href={back} className="-mx-1 mb-6 inline-flex min-h-11 items-center px-1 text-moss hover:underline">
          ← Your experiment
        </Link>
      )}
      {children}
    </div>
  );
}

/** Same shape as the report: heading, verdict, two cards, chart. */
export function LabReportSkeleton() {
  return (
    <div aria-hidden="true" className="page-frame pt-8 sm:pt-14">
      <div className="h-5 w-32 rounded-pill bg-line" />
      <div className="mt-6 h-3 w-40 rounded-pill bg-line" />
      <div className="mt-3 h-10 w-3/4 rounded-pill bg-line" />
      <div className="mt-8 h-48 rounded-card bg-paper" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-card bg-paper" />
        <div className="h-64 rounded-card bg-paper" />
      </div>
      <div className="mt-6 h-72 rounded-card bg-paper" />
    </div>
  );
}
