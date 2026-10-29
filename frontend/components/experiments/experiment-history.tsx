"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listExperiments } from "@/lib/data/experiments";
import { getReport } from "@/lib/data/reports";
import { SIGNAL_COPY, signedPercent } from "@/lib/report/copy";
import type { Experiment, Report } from "@/lib/types/api";

type HistoryLoad =
  | { kind: "loading" }
  | { kind: "ready"; experiments: Experiment[] }
  | { kind: "error"; status: number; message: string };

const secondary = "inline-flex min-h-11 items-center rounded-pill px-4 text-body font-medium text-moss underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss";
const primary = "inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-body font-medium text-paper hover:bg-moss-deep";

export function ExperimentHistory() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [load, setLoad] = useState<HistoryLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace("/sign-in?next=/history");
      return;
    }

    let cancelled = false;
    listExperiments("completed")
      .then((experiments) => {
        if (!cancelled) setLoad({ kind: "ready", experiments });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/sign-in?next=/history");
          return;
        }
        setLoad({
          kind: "error",
          status: error instanceof ApiError ? error.status : 0,
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, router, session, sessionLoading]);

  if (sessionLoading || !session || load.kind === "loading") return <HistorySkeleton />;

  if (load.kind === "error") {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
        <Link href="/" className={secondary}>← Your lab</Link>
        <div role="alert" className="mt-8 rounded-card bg-clay-tint p-6 text-clay sm:p-8">
          <h1 className="font-display text-headline">We couldn&apos;t load your history.</h1>
          <p className="mt-3 text-body">{load.message}</p>
          <button
            type="button"
            onClick={() => {
              setLoad({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-paper px-5 text-body font-medium text-ink"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
      <Link href="/" className={secondary}>← Your lab</Link>
      <div className="mt-5">
        <p className="font-mono text-caption text-moss">What you&apos;ve learned</p>
        <h1 className="mt-2 font-display text-headline tracking-tight sm:text-display-sm">Your experiment history</h1>
        <p className="mt-3 max-w-2xl text-lead text-muted">
          Look back at your predictions and the patterns your experiments found.
        </p>
      </div>

      {load.experiments.length === 0 ? (
        <section className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
          <h2 className="font-display text-title">Your next discovery starts with a question.</h2>
          <p className="mt-2 text-body text-muted">Completed experiments will appear here.</p>
          <Link href="/experiments/new" className={`${primary} mt-5`}>Test a new question</Link>
        </section>
      ) : (
        <ol aria-label="Completed experiments" className="mt-8 flex flex-col gap-5">
          {load.experiments.map((experiment) => (
            <HistoryItem key={experiment.id} experiment={experiment} />
          ))}
        </ol>
      )}
    </main>
  );
}

function HistoryItem({ experiment }: { experiment: Experiment }) {
  const [reportState, setReportState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; report: Report | null }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getReport(experiment.id)
      .then((report) => {
        if (!cancelled) setReportState({ kind: "ready", report });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/sign-in?next=/history");
          return;
        }
        setReportState({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, experiment.id, router]);

  const report = reportState.kind === "ready" ? reportState.report : null;
  const primaryMetric = report?.analysis.metrics.find((metric) => metric.key === report.analysis.primary_metric);
  const predictionMetricLabel = experiment.metrics.find((metric) => metric.key === experiment.prediction.target_metric)?.label
    ?? experiment.prediction.target_metric;
  const observedMetricLabel = primaryMetric?.label ?? predictionMetricLabel;
  const completedOn = experiment.completed_at
    ? new Date(experiment.completed_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <li>
      <article aria-label={experiment.question} className="rounded-card border border-line bg-paper p-5 sm:p-7">
        <p className="font-mono text-caption text-muted">
          {completedOn ? `Finished ${completedOn}` : "Completed experiment"}
        </p>
        <h2 className="mt-2 font-display text-title sm:text-headline">{experiment.question}</h2>

        <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-muted">Prediction</dt>
            <dd className="mt-1 font-medium">
              {predictionMetricLabel} {formatRange(experiment.prediction.expected_change_min, experiment.prediction.expected_change_max)}
            </dd>
          </div>
          {reportState.kind === "loading" && (
            <div role="status" className="text-caption text-muted">Loading report…</div>
          )}
          {reportState.kind === "error" && (
            <div className="sm:col-span-2" role="alert">
              <dt className="text-caption text-clay">Couldn&apos;t load this report</dt>
              <dd className="mt-1 text-caption text-muted">{reportState.message}</dd>
              <button
                type="button"
                onClick={() => {
                  setReportState({ kind: "loading" });
                  setAttempt((value) => value + 1);
                }}
                className="mt-2 inline-flex min-h-11 items-center rounded-pill px-3 text-body font-medium text-moss underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
          {reportState.kind === "ready" && !report && (
            <div className="sm:col-span-2">
              <dt className="text-caption text-muted">Results</dt>
              <dd className="mt-1 text-body text-muted">Report not available yet.</dd>
            </div>
          )}
          {report && (
            <>
              <div>
                <dt className="text-caption text-muted">Observed outcome</dt>
                <dd className="mt-1 font-medium">
                  {observedMetricLabel} {primaryMetric?.percent_change === null || primaryMetric?.percent_change === undefined
                    ? "Not enough data"
                    : signedPercent(primaryMetric.percent_change)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted">Signal</dt>
                <dd className="mt-1 font-medium">{SIGNAL_COPY[report.analysis.signal.classification].label}</dd>
              </div>
            </>
          )}
        </dl>

        <Link href={`/experiments/${encodeURIComponent(experiment.id)}/report`} className={`${secondary} mt-4`}>
          Open Lab Report
        </Link>
      </article>
    </li>
  );
}

function formatRange(min: number, max: number) {
  const low = Math.round(min);
  const high = Math.round(max);
  const lowText = signedPercent(low).replace(/%$/, "");
  const highText = signedPercent(high).replace(/^\+/, "");
  return `${lowText}–${highText}`;
}

function HistorySkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
      <span className="sr-only">Loading your experiment history</span>
      <div aria-hidden="true" className="animate-pulse">
        <div className="h-11 w-28 rounded-pill bg-line" />
        <div className="mt-8 h-4 w-40 rounded-pill bg-line" />
        <div className="mt-3 h-12 w-3/4 rounded-pill bg-line" />
        <div className="mt-3 h-6 w-full max-w-xl rounded-pill bg-line" />
        <div className="mt-8 flex flex-col gap-5">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-card border border-line bg-paper p-5 sm:p-7">
              <div className="h-4 w-36 rounded-pill bg-line" />
              <div className="mt-4 h-7 w-4/5 rounded-pill bg-line" />
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((column) => <div key={column} className="h-12 rounded-card bg-oat" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
