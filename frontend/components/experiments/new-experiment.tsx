"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExperimentFlow } from "@/components/experiments/experiment-flow";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/profile";
import type { Profile } from "@/lib/types/api";

export { ForecastCard } from "@/components/experiments/experiment-flow";

const secondary = "min-h-11 rounded-pill border border-line bg-paper px-5 py-2 font-medium hover:border-moss";

export function NewExperiment({ initialQuestion = "" }: { initialQuestion?: string }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/sign-in?next=/experiments/new");
      return;
    }
    let cancelled = false;
    getProfile().then((profile) => {
      if (cancelled) return;
      if (!profile) router.replace("/onboarding");
      else setLoaded({ userId: session.user.id, profile });
    }).catch((e: Error) => {
      if (cancelled) return;
      if (e instanceof ApiError && e.status === 401) router.replace("/sign-in?next=/experiments/new");
      else setProfileError(e.message);
    });
    return () => { cancelled = true; };
  }, [loading, session, router, attempt]);

  const profile = session && loaded?.userId === session.user.id ? loaded.profile : null;
  if (loading || !session || !profile) {
    return (
      <div className="page-frame py-12">
        {profileError ? (
          <div role="alert" className="rounded-card bg-clay-tint p-6 text-clay">
            <p>Couldn&apos;t load your rhythm: {profileError}</p>
            <button
              type="button"
              className={`${secondary} mt-4 text-ink`}
              onClick={() => {
                setProfileError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div role="status">
            <span className="sr-only">Loading your rhythm</span>
            <div aria-hidden="true" className="space-y-6">
              <div className="h-12 w-3/4 rounded-pill bg-line" />
              <div className="h-56 rounded-card bg-paper" />
              <div className="h-32 rounded-card bg-paper" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-frame pt-8 pb-16 sm:pt-14">
      <Link href="/" className="inline-flex min-h-11 items-center text-moss hover:underline">
        ← Your lab
      </Link>
      <ExperimentFlow
        key={session.user.id}
        profile={profile}
        initialQuestion={initialQuestion}
      />
    </div>
  );
}
