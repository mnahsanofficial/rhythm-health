"use client";

import { ChoiceGroup } from "@/components/onboarding/choice-group";
import type { OnboardingDraft } from "@/lib/onboarding/draft";
import type { AgeRange } from "@/lib/types/api";

export type StepProps = {
  draft: OnboardingDraft;
  update: (patch: OnboardingDraft) => void;
};

export type Step = {
  id: string;
  question: string;
  why: string;
  isAnswered: (draft: OnboardingDraft) => boolean;
  Body: (props: StepProps) => React.ReactNode;
};

const AGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" },
  { value: "55-64", label: "55–64" },
  { value: "65+", label: "65 or over" },
];

function AgeBody({ draft, update }: StepProps) {
  return (
    <ChoiceGroup
      legend="Your age range"
      options={AGE_OPTIONS}
      value={draft.age_range}
      onChange={(age_range) => update({ age_range })}
    />
  );
}

/** Questions in order. Each one fills one profile field (TRD §12.1). */
export const STEPS: Step[] = [
  {
    id: "age",
    question: "How old are you?",
    why: "A range is enough. It helps us start with sensible predictions.",
    isAnswered: (d) => Boolean(d.age_range),
    Body: AgeBody,
  },
];

/** Questions planned in total, so progress is honest from the first one. */
export const QUESTION_COUNT = 7;
