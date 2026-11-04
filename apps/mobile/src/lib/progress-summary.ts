import type { OutcomeChoice, ProgressSummary } from '@rhythm-health/contract';
import { apiGet, apiPost } from './api';

/** Worked out by the backend from saved reports. No AI call. */
export const getProgressSummary = (token: string): Promise<ProgressSummary> =>
  apiGet(token, '/api/experiments/progress-summary', "Couldn't load your progress. Try again.");
export const saveOutcome = (token: string, experimentId: string, choice: OutcomeChoice): Promise<unknown> =>
  apiPost(token, `/api/experiments/${encodeURIComponent(experimentId)}/outcome`, { choice }, "Couldn't save your choice. Try again.");
