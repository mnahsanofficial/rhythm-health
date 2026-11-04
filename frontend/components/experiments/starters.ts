import { GOAL_QUESTIONS } from "@/components/onboarding/steps";
import type { Profile } from "@/lib/types/api";

/** Suggested questions: the person's own goals first, then examples that aren't about the same thing. */
export function starters(profile: Profile): string[] {
  const questions = profile.goals.slice(0, 2).map((goal) =>
    GOAL_QUESTIONS[goal as keyof typeof GOAL_QUESTIONS] ?? `What small change could help with: ${goal}?`,
  );
  const examples = [
    { question: "Does walking after dinner improve my sleep?", goals: ["Fall asleep faster"] },
    { question: "Does less caffeine improve my focus?", goals: ["Better focus"] },
    { question: "Does waking earlier actually improve my productivity?", goals: ["More energy in the morning"] },
  ];
  const distinctExamples = examples
    .filter(({ goals }) => !profile.goals.some((goal) => goals.includes(goal)))
    .map(({ question }) => question);
  return [...new Set([...questions, ...distinctExamples])].filter((question) => question.length <= 500);
}
