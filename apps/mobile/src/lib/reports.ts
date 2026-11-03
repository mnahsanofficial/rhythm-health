import type { Experiment, LabReport, NotEnoughCheckins, SignalClass, SignalReason } from '@rhythm-health/contract';
import { ApiError, apiGet, apiPost } from './api';

const path = (id: string) => `/api/experiments/${encodeURIComponent(id)}`;

/** A 404 means no report yet, or an experiment this account can't reach; `getExperiment` tells them apart. */
export async function getReport(token: string, id: string): Promise<LabReport | null> {
  try { return await apiGet<LabReport>(token, `${path(id)}/report`, "We couldn't load this report."); }
  catch (cause) { if (cause instanceof ApiError && cause.status === 404) return null; throw cause; }
}
export const getExperiment = (token: string, id: string): Promise<Experiment> =>
  apiGet(token, path(id), "We couldn't load this report.");
/** Deterministic and free. The written narrative stays null until `writeReport`. */
export const completeExperiment = (token: string, id: string): Promise<LabReport> =>
  apiPost(token, `${path(id)}/complete`, {}, "Couldn't finish the experiment.");
/** One paid model call, from an explicit tap only. Never sends ?regenerate=true. */
export const writeReport = (token: string, id: string): Promise<LabReport> =>
  apiPost(token, `${path(id)}/report`, {}, 'Something went wrong while writing your report.');

export function notEnoughCheckins(error: unknown): NotEnoughCheckins | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const detail = error.detail as Partial<NotEnoughCheckins> | null | undefined;
  return detail && typeof detail.baseline_required === 'number' ? detail as NotEnoughCheckins : null;
}

// Same wording as the web's lib/report/copy.ts. Never says "proves".
export const SIGNAL_COPY: Record<SignalClass, { label: string; summary: string }> = {
  likely_signal: { label: 'Likely signal', summary: 'The change was consistent and bigger than your normal day-to-day ups and downs.' },
  possible_signal: { label: 'Possible signal', summary: 'It moved the way we expected, but the evidence is still limited.' },
  unclear: { label: 'Unclear', summary: "The data doesn't clearly support the idea or rule it out." },
  probably_noise: { label: 'Probably noise', summary: 'The changes were small or inconsistent compared with your normal variation.' },
};

export function reasonText(reason: SignalReason, criteriaPercent: number): string {
  switch (reason) {
    case 'insufficient_data': return "One of the phases didn't have enough check-ins to compare.";
    case 'change_meets_success_criteria': return `The change reached at least ${criteriaPercent}%, the size we set out to look for.`;
    case 'change_below_success_criteria': return `It moved the expected way, but by less than the ${criteriaPercent}% we set out to look for.`;
    case 'consistent_direction': return 'Most test days moved in the same direction.';
    case 'inconsistent_direction': return 'Test days went up and down without a clear pattern.';
    case 'larger_than_normal_variation': return 'The change was bigger than your normal day-to-day variation.';
    case 'within_normal_variation': return 'The change stayed within your normal day-to-day variation.';
    case 'low_adherence': return 'You made the change on fewer than 6 in 10 test days.';
    case 'few_intervention_days': return 'Fewer than 5 test days were logged, so treat this as a first look.';
    case 'moved_opposite_to_prediction': return 'It moved the opposite way to the prediction.';
    default: return "We don't have an explanation for this detail yet.";
  }
}

/** Whole percents by default; preserve up to two decimals for a committed personal guess. */
export function reportPercent(value: number, decimals = 0): string {
  const shown = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
  return `${shown > 0 ? '+' : ''}${shown}%`;
}

export function writeErrorText(status: number, message: string): string {
  if (status === 503) return "The writing service isn't available right now.";
  if (status === 502) return "We couldn't write a report that matched your results.";
  if (status === 409) return 'This experiment needs to be finished before its report can be written.';
  if (status === 404) return 'There are no results to write about yet.';
  if (status === 0) return "We couldn't reach the server. Check your connection.";
  return message || 'Something went wrong while writing your report.';
}
