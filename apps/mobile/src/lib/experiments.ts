import type { ActiveCapacity, Experiment, ExperimentTimeline } from '@rhythm-health/contract';
import { apiGet } from './api';

export const listActiveExperiments = (token: string): Promise<Experiment[]> =>
  apiGet(token, '/api/experiments?status=active', "Couldn't load your day. Try again.");
export const getCapacity = (token: string): Promise<ActiveCapacity> =>
  apiGet(token, '/api/experiments/capacity', "Couldn't load your day. Try again.");
export const getProgress = (token: string, id: string): Promise<ExperimentTimeline> =>
  apiGet(token, `/api/experiments/${encodeURIComponent(id)}/progress`, "Couldn't load your day. Try again.");

/** The server's phase counts say today is the last normal day, so the test starts on the next one. */
export const isLastBaselineDay = ({ progress }: ExperimentTimeline) =>
  progress.state === 'in_progress' && progress.phase === 'baseline' && progress.phase_day !== null && progress.phase_day === progress.phase_days;
/** "Your test starts tomorrow: Walk for 20 minutes." */
export const testStartsLine = (action: string) => `Your test starts tomorrow: ${action.replace(/\.$/, '')}.`;
