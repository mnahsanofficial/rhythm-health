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
/** Calendar wording only: the server still owns every experiment day and boundary. */
export const displayDayTime = (timestamp: string) => new Date(timestamp).toLocaleString('en-GB', {
  weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
}).replace(/am|pm/, value => value.toUpperCase());

export function testStartWhen(nextDayAt: string | null, now = new Date()) {
  if (!nextDayAt || Number.isNaN(Date.parse(nextDayAt))) return 'on the next experiment day';
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(nextDayAt).toDateString() === tomorrow.toDateString() ? 'tomorrow' : displayDayTime(nextDayAt);
}
export const testStartsLine = (action: string, nextDayAt: string | null, now = new Date()) =>
  `Your test starts ${testStartWhen(nextDayAt, now)}: ${action.replace(/\.$/, '')}.`;
