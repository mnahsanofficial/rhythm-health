"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Experiment } from "@rhythm-health/contract";
import { ApiError } from "@/lib/api/client";
import { removeSample, startActiveSample } from "@/lib/data/demo";

export function SampleControls({ experiment, onChanged }: { experiment?: Experiment; onChanged: () => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const button = "min-h-12 rounded-pill border border-line bg-paper px-5 text-body font-medium text-ink hover:border-moss disabled:opacity-60";
  async function act() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      if (experiment) await removeSample(experiment.id);
      else await startActiveSample();
      setConfirm(false); onChanged();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) router.replace("/sign-in?next=/");
      else setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { pending.current = false; setBusy(false); }
  }
  if (experiment && !experiment.is_seeded) return null;
  return <section className="my-6 border-y border-line py-5" aria-label="Sample experiment controls">
    <p className="font-medium text-moss">{experiment ? "Sample experiment" : "Try the daily loop with a sample"}</p>
    <p className="mt-2 text-muted">Sample answers never become your real experiment data. Fixed design and prediction, with no AI calls.</p>
    {experiment && <p className="mt-2 text-muted">Remove the sample to free the active slot for a real experiment.</p>}
    {error && <p role="alert" className="mt-3 text-clay">{error}</p>}
    {confirm ? <div className="mt-4" role="group" aria-labelledby="sample-removal-heading">
      <h2 id="sample-removal-heading" tabIndex={-1} ref={heading} className="font-display text-title">Remove this sample experiment?</h2>
      <p className="mt-2">Only this sample and its check-ins will be deleted. Your real experiments stay saved.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={button} disabled={busy} onClick={() => void act()}>{busy ? "Removing sample…" : "Confirm remove sample"}</button>
        <button type="button" className={button} disabled={busy} onClick={() => { setConfirm(false); requestAnimationFrame(() => trigger.current?.focus()); }}>Keep sample</button>
      </div>
    </div> : <button ref={trigger} type="button" className={`${button} mt-4`} disabled={busy} onClick={() => {
      if (experiment) { setConfirm(true); requestAnimationFrame(() => heading.current?.focus()); }
      else void act();
    }}>{busy ? "Starting sample…" : experiment ? "Remove sample" : "Try a sample experiment"}</button>}
  </section>;
}
