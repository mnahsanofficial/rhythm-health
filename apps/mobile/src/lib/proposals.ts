import type { Experiment, ProposeResponse, SaveExperimentRequest } from '@rhythm-health/contract';
import { apiPost } from './api';

export const proposeExperiment = (token: string, question: string): Promise<ProposeResponse> =>
  apiPost(token, '/api/experiments/propose', { question }, "Your question hasn't been submitted successfully.");
export const saveExperiment = (token: string, body: SaveExperimentRequest): Promise<Experiment> =>
  apiPost(token, '/api/experiments', body, "Couldn't save your experiment. Try again.");
export const startExperiment = (token: string, id: string): Promise<Experiment> =>
  apiPost(token, `/api/experiments/${encodeURIComponent(id)}/start`, {}, 'Try again.');

export const QUESTION_MIN = 5;
export const QUESTION_MAX = 500;
export const GUESS_MIN = -100;
export const GUESS_MAX = 200;

/** Same helper validation as the web's PersonalGuess; the backend's check stays authoritative. */
export function parseGuess(answer: string): number | null {
  const normalized = answer.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= GUESS_MIN && value <= GUESS_MAX ? value : null;
}

export const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

/** Said on Ask and in You. */
export const TRUST_LINE = 'Your question goes to an AI to design the experiment, and the AI puts your results into words. The numbers come from your own check-ins.';

const GOAL_QUESTIONS: Record<string, string> = {
  'More energy in the morning': 'What could give me more energy in the morning?',
  'Better focus': 'What could help me focus better?',
  'Fall asleep faster': 'What could help me fall asleep faster?',
  'Fewer afternoon slumps': 'What could help me avoid afternoon slumps?',
  'Calmer evenings': 'What could make my evenings feel calmer?',
  'Move more during the day': 'What could help me move more during the day?',
  'Eat more vegetables': 'What could help me eat more vegetables?',
  'A steadier routine': 'What could help me build a steadier routine?',
};
const EXAMPLES = [
  { question: 'Does walking after dinner improve my sleep?', goals: ['Fall asleep faster'] },
  { question: 'Does less caffeine improve my focus?', goals: ['Better focus'] },
  { question: 'Does waking earlier actually improve my productivity?', goals: ['More energy in the morning'] },
];

/** The web's "Start with a hunch" list: two from the person's goals, then everyday examples. */
export function questionStarters(goals: string[]): string[] {
  // A goal someone typed has no written question, and a template can't read as a plain one, so the examples fill in.
  const fromGoals = goals.flatMap(goal => GOAL_QUESTIONS[goal] ?? []).slice(0, 2);
  const examples = EXAMPLES.filter(example => !goals.some(goal => example.goals.includes(goal))).map(example => example.question);
  return [...new Set([...fromGoals, ...examples])].filter(question => question.length <= QUESTION_MAX);
}
