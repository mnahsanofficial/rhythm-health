"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { resetDemo } from "@/lib/data/demo";

const buttonClass =
  "inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-pill border border-line bg-paper px-6 text-body font-medium text-ink transition-colors hover:border-moss hover:text-moss disabled:cursor-wait disabled:opacity-60";

export function DemoEntry() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !session) return null;

  async function openDemo() {
    if (preparing) return;
    setPreparing(true);
    setError(null);
    try {
      const { experiment } = await resetDemo();
      router.push(`/experiments/${encodeURIComponent(experiment.id)}/report`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/sign-in?next=/");
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <section aria-labelledby="demo-entry-heading" className="mt-5 rounded-card border border-line bg-paper p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="demo-entry-heading" className="font-display text-title">
            See a completed example
          </h2>
          <p className="mt-1 text-body text-muted">
            Explore a seeded experiment and its Lab Report.
          </p>
        </div>
        <button type="button" disabled={preparing} onClick={() => void openDemo()} className={buttonClass}>
          {preparing ? "Preparing the demo…" : "Explore a completed example"}
        </button>
      </div>
      {error && (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-card bg-clay-tint p-4 text-clay sm:flex-row sm:items-center">
          <p className="flex-1">Couldn&apos;t prepare the demo: {error}</p>
          <button
            type="button"
            disabled={preparing}
            onClick={() => void openDemo()}
            className="min-h-11 rounded-pill bg-paper px-5 text-body font-medium text-ink disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
