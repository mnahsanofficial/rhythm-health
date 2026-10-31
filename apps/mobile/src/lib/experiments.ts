import type { Experiment, ExperimentTimeline } from '@rhythm-health/contract';
import { apiGet } from './api';

export const listActiveExperiments = (token: string): Promise<Experiment[]> =>
  apiGet(token, '/api/experiments?status=active', "Couldn't load your day. Try again.");
export const getProgress = (token: string, id: string): Promise<ExperimentTimeline> =>
  apiGet(token, `/api/experiments/${encodeURIComponent(id)}/progress`, "Couldn't load your day. Try again.");
