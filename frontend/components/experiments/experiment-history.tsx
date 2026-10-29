"use client";

import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { listExperiments } from "@/lib/data/experiments";
import { getReport } from "@/lib/data/reports";
import { SIGNAL_COPY, signedPercent } from "@/lib/report/copy";
import type { Experiment, LabReport } from "@/lib/types/api";

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
  const [order, setOrder] = useState<"newest" | "oldest">("newest");

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
      <div className="page-frame pt-8 pb-16 sm:pt-14">
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
      </div>
    );
  }

  const ordered = [...load.experiments].sort((a, b) => {
    const stamp = (experiment: Experiment) => Date.parse(experiment.completed_at ?? experiment.created_at) || 0;
    return order === "newest" ? stamp(b) - stamp(a) : stamp(a) - stamp(b);
  });

  return (
    <div className="page-frame pt-8 pb-16 sm:pt-14">
      <Link href="/" className={secondary}>← Your lab</Link>
      <div className="mt-5">
        <p className="font-mono text-caption text-moss">What you&apos;ve learned</p>
        <h1 className="mt-2 font-display text-headline tracking-tight sm:text-display-sm">Your experiment history</h1>
        <p className="mt-3 text-lead text-muted">
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
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <p role="status" className="font-mono text-caption text-muted tabular-nums">
              {ordered.length} completed {ordered.length === 1 ? "experiment" : "experiments"} · {order} first
            </p>
            <fieldset className="flex gap-1 rounded-pill bg-paper p-1">
              <legend className="sr-only">Sort experiments</legend>
              {(["newest", "oldest"] as const).map(value => (
                <label
                  key={value}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-pill px-4 text-body has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${order === value ? "bg-moss text-paper" : "text-muted hover:text-ink"}`}
                >
                  <input type="radio" name="history-order" value={value} checked={order === value} onChange={() => setOrder(value)} className="sr-only" />
                  {value === "newest" ? "Newest first" : "Oldest first"}
                </label>
              ))}
            </fieldset>
          </div>
          <ol aria-label="Completed experiments" className="mt-5 divide-y divide-line border-b border-line">
            {ordered.map((experiment) => (
              <HistoryItem key={experiment.id} experiment={experiment} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function HistoryItem({ experiment }: { experiment: Experiment }) {
  const reduce = useReducedMotion();
  const [reportState, setReportState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; report: LabReport | null }
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
    <motion.li layout={reduce ? false : "position"} transition={{ duration: reduce ? 0 : MOTION_DURATION.response, ease: MOTION_EASE.settle }}>
      <article aria-label={experiment.question} className="py-7 sm:py-9">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-caption text-muted">{completedOn ? `Finished ${completedOn}` : "Completed experiment"}</p>
          {experiment.is_seeded && <span className="rounded-pill bg-line px-3 py-1 text-caption text-ink">Sample experiment</span>}
        </div>
        <h2 className="mt-2 font-display text-title sm:text-headline">{experiment.question}</h2>

        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 lg:grid-cols-[1fr_1fr_0.8fr]">
          <div>
            <dt className="border-l-2 border-night pl-3 text-caption text-muted">Prediction</dt>
            <dd className="mt-1 font-medium">
              <span className="block text-caption font-normal text-muted">{predictionMetricLabel}</span>{" "}
              <span className="font-mono text-title text-night tabular-nums">{formatRange(experiment.prediction.expected_change_min, experiment.prediction.expected_change_max)}</span>
            </dd>
          </div>
          {reportState.kind === "loading" && (
            <>
              <div role="status" className="min-h-16 text-caption text-muted">
                Loading report…
                <div aria-hidden="true" className="mt-2 h-7 w-24 rounded-pill bg-line" />
              </div>
              <div aria-hidden="true" className="min-h-16">
                <div className="h-4 w-12 rounded-pill bg-line" />
                <div className="mt-3 h-7 w-28 rounded-pill bg-line" />
              </div>
            </>
          )}
          {reportState.kind === "error" && (
            <div className="col-span-2" role="alert">
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
            <div className="col-span-2">
              <dt className="text-caption text-muted">Results</dt>
              <dd className="mt-1 text-body text-muted">Report not available yet.</dd>
            </div>
          )}
          {report && (
            <>
              <div>
                <dt className="border-l-2 border-moss pl-3 text-caption text-muted">Observed outcome</dt>
                <dd className="mt-1 font-medium">
                  <span className="block text-caption font-normal text-muted">{observedMetricLabel}</span>{" "}
                  <span className="font-mono text-title tabular-nums">{primaryMetric?.percent_change === null || primaryMetric?.percent_change === undefined
                    ? "Not enough data"
                    : signedPercent(primaryMetric.percent_change)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted">Signal</dt>
                <dd className="mt-2 inline-flex rounded-pill bg-moss-tint px-3 py-1 text-body font-medium text-ink">{SIGNAL_COPY[report.analysis.signal.classification].label}</dd>
              </div>
            </>
          )}
        </dl>

        <Link href={`/experiments/${encodeURIComponent(experiment.id)}/report`} className={`${secondary} mt-4`}>
          Open Lab Report
        </Link>
      </article>
    </motion.li>
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
    <div aria-busy="true" className="page-frame pt-8 pb-16 sm:pt-14">
      <span className="sr-only">Loading your experiment history</span>
      <div aria-hidden="true" className="space-y-1">
        <div className="h-11 w-28 rounded-pill bg-line" />
        <div className="mt-8 h-4 w-40 rounded-pill bg-line" />
        <div className="mt-3 h-12 w-3/4 rounded-pill bg-line" />
        <div className="mt-3 h-6 w-full max-w-xl rounded-pill bg-line" />
        <div className="mt-8 flex flex-col gap-5">
          {[0, 1].map((item) => (
            <div key={item} className="border-b border-line py-7">
              <div className="h-4 w-36 rounded-pill bg-line" />
              <div className="mt-4 h-7 w-4/5 rounded-pill bg-line" />
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((column) => <div key={column} className="h-12 rounded-card bg-oat" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
