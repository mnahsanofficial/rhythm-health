import { apiGet, apiSend, ApiError } from "@/lib/api/client";
import type { LabReport, NotEnoughCheckins } from "@rhythm-health/contract";

/** The experiment's Lab Report, or null if it hasn't been completed yet (the API answers 404). */
export async function getReport(experimentId: string): Promise<LabReport | null> {
  try {
    return await apiGet<LabReport>(`/api/experiments/${encodeURIComponent(experimentId)}/report`, true);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Run the deterministic analysis and mark the experiment completed. No model call; narrative is null. */
export function completeExperiment(experimentId: string): Promise<LabReport> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(experimentId)}/complete`);
}

/**
 * Have the backend write the narrative: one paid model call. Idempotent on the backend, so a
 * repeat returns the stored narrative. We never send ?regenerate=true.
 */
export function writeReport(experimentId: string): Promise<LabReport> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(experimentId)}/report`);
}

/** The check-in counts from a 409 "not enough check-ins", or null for any other error. */
export function notEnoughCheckins(error: unknown): NotEnoughCheckins | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const d = error.detail as Partial<NotEnoughCheckins> | null;
  return d && typeof d.baseline_required === "number" ? (d as NotEnoughCheckins) : null;
}
