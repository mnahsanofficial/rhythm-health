import type { Experiment, LabReport } from '@rhythm-health/contract';
import { apiGet, apiPost } from './api';

export const listCompletedExperiments = (token: string): Promise<Experiment[]> =>
  apiGet(token, '/api/experiments?status=completed', "Couldn't load your history. Try again.");
/** Writes the signed-in user's seeded completed experiment. No AI call. */
export const resetDemo = (token: string): Promise<LabReport> =>
  apiPost(token, '/api/demo/reset', {}, 'Something went wrong. Please try again.');
