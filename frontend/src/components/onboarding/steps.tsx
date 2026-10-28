"use client";

import { ChipPicker } from "@/components/onboarding/chip-picker";
import { ChoiceGroup } from "@/components/onboarding/choice-group";
import { RhythmRing } from "@/components/rhythm-ring";
import type { OnboardingDraft } from "@/lib/onboarding/draft";
import { placeHabits } from "@/lib/rhythm/habits";
import { formatDuration, formatHours, minutesBetween } from "@/lib/rhythm/time";
import type { ActivityLevel, AgeRange } from "@/lib/types/api";

export type StepProps = {
  draft: OnboardingDraft;
  update: (patch: OnboardingDraft) => void;
};

export type Step = {
  id: string;
  question: string;
  why: string;
  isAnswered: (draft: OnboardingDraft) => boolean;
  /** Fields to save when leaving the step forward, e.g. a suggested value the user accepted as is. */
  complete?: (draft: OnboardingDraft) => OnboardingDraft;
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

// A night shorter than 3 hours or longer than 14 is almost always a mistyped time.
const MIN_NIGHT_MIN = 3 * 60;
const MAX_NIGHT_MIN = 14 * 60;

function nightMinutes(draft: OnboardingDraft): number | null {
  const s = draft.usual_sleep_schedule;
  return s?.bedtime && s.wake_time ? minutesBetween(s.bedtime, s.wake_time) : null;
}

export function nightIsPlausible(draft: OnboardingDraft) {
  const m = nightMinutes(draft);
  return m !== null && m >= MIN_NIGHT_MIN && m <= MAX_NIGHT_MIN;
}

/** Time in bed minus half an hour, rounded down to the half hour: a fair first guess at actual sleep. */
function suggestedSleepHours(draft: OnboardingDraft): number {
  const m = nightMinutes(draft) ?? 8 * 60;
  return Math.max(MIN_HOURS, Math.min(MAX_HOURS, Math.floor(((m - 30) / 60) * 2) / 2));
}

/** Ring shown inside the sleep steps on phones; on wide screens the side panel shows it instead. */
function InlineRing({ draft }: { draft: OnboardingDraft }) {
  return (
    <div className="mx-auto mt-8 w-full max-w-[260px] lg:hidden">
      <RhythmRing
        schedule={nightIsPlausible(draft) ? draft.usual_sleep_schedule : undefined}
        sleepHours={draft.usual_sleep_hours}
        habits={placeHabits(draft.regular_habits ?? [])}
      />
    </div>
  );
}

function ScheduleBody({ draft, update }: StepProps) {
  const schedule = { bedtime: "", wake_time: "", ...draft.usual_sleep_schedule };
  const minutes = nightMinutes(draft);
  // New times mean a new guess at hours asleep, so clear any earlier one.
  const set = (patch: Partial<typeof schedule>) =>
    update({ usual_sleep_schedule: { ...schedule, ...patch }, usual_sleep_hours: undefined });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Bedtime" value={schedule.bedtime} onChange={(bedtime) => set({ bedtime })} />
        <TimeField label="Wake time" value={schedule.wake_time} onChange={(wake_time) => set({ wake_time })} />
      </div>
      <p aria-live="polite" className="mt-3 min-h-6 text-body text-muted">
        {minutes === null
          ? ""
          : nightIsPlausible(draft)
            ? `That's ${formatDuration(minutes)} in bed.`
            : `That's ${formatDuration(minutes)} in bed. Check the times?`}
      </p>
      <InlineRing draft={draft} />
    </>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-ink">{label}</span>
      <input
        type="time"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-14 w-full rounded-card border border-line bg-paper px-4 font-mono text-lead text-ink tabular-nums focus-visible:border-moss"
      />
    </label>
  );
}

const MIN_HOURS = 3;
const MAX_HOURS = 12;

function HoursBody({ draft, update }: StepProps) {
  const hours = draft.usual_sleep_hours ?? suggestedSleepHours(draft);
  const minutesInBed = nightMinutes(draft) ?? 0;
  const inBed = formatDuration(minutesInBed);
  // Can't sleep longer than you're in bed: cap at the night, to the half hour below.
  const max = Math.min(MAX_HOURS, Math.floor((minutesInBed / 60) * 2) / 2);
  const set = (h: number) => update({ usual_sleep_hours: Math.max(MIN_HOURS, Math.min(max, h)) });

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-paper p-3">
        <StepperButton label="Half an hour less" disabled={hours <= MIN_HOURS} onClick={() => set(hours - 0.5)}>
          −
        </StepperButton>
        <output aria-live="polite" className="text-center">
          <span className="block font-display text-display-sm tabular-nums">{formatHours(hours)}</span>
          <span className="block text-caption text-muted">hours asleep</span>
        </output>
        <StepperButton label="Half an hour more" disabled={hours >= max} onClick={() => set(hours + 0.5)}>
          +
        </StepperButton>
      </div>
      <p className="mt-3 text-body text-muted">
        {hours === suggestedSleepHours(draft)
          ? `Our guess from ${inBed} in bed. Change it if it's off.`
          : `Out of ${inBed} in bed.`}
      </p>
      <InlineRing draft={draft} />
    </>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-14 shrink-0 place-items-center rounded-full bg-moss-tint text-headline text-moss transition-[background-color,scale] hover:bg-moss hover:text-paper active:scale-95 disabled:opacity-40 disabled:hover:bg-moss-tint disabled:hover:text-moss"
    >
      {children}
    </button>
  );
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "mostly_sedentary", label: "Mostly sitting", hint: "Desk-based, not much walking" },
  { value: "lightly_active", label: "Lightly active", hint: "Some walking most days" },
  { value: "moderately_active", label: "Moderately active", hint: "Exercise two or three times a week" },
  { value: "very_active", label: "Very active", hint: "Training or physical work most days" },
];

function ActivityBody({ draft, update }: StepProps) {
  return (
    <ChoiceGroup
      legend="How active you are"
      options={ACTIVITY_OPTIONS}
      value={draft.activity_level}
      onChange={(activity_level) => update({ activity_level })}
    />
  );
}

// Outcomes people can notice day to day. No weight, calorie or medical goals.
const GOAL_OPTIONS = [
  "More energy in the morning",
  "Better focus",
  "Fall asleep faster",
  "Fewer afternoon slumps",
  "Calmer evenings",
  "Move more during the day",
  "Eat more vegetables",
  "A steadier routine",
];
const MAX_GOALS = 3;

function GoalsBody({ draft, update }: StepProps) {
  return (
    <ChipPicker
      legend="Goals"
      options={GOAL_OPTIONS}
      value={draft.goals ?? []}
      onChange={(goals) => update({ goals })}
      max={MAX_GOALS}
      addLabel="Something else?"
      addPlaceholder="e.g. Feel less groggy on Mondays"
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
  {
    id: "schedule",
    question: "When do you usually sleep?",
    why: "On a normal workday. Rough times are fine.",
    isAnswered: nightIsPlausible,
    complete: (d) => ({ usual_sleep_hours: d.usual_sleep_hours ?? suggestedSleepHours(d) }),
    Body: ScheduleBody,
  },
  {
    id: "hours",
    question: "How much of that is actual sleep?",
    why: "Most people sleep a little less than they're in bed. A guess is fine.",
    isAnswered: nightIsPlausible,
    Body: HoursBody,
  },
  {
    id: "activity",
    question: "How much do you move on a typical day?",
    why: "No need to be exact. This helps us suggest changes that fit.",
    isAnswered: (d) => Boolean(d.activity_level),
    Body: ActivityBody,
  },
  {
    id: "goals",
    question: "What would you like to improve?",
    why: "Pick up to three. Your first experiment will start from one of these.",
    isAnswered: (d) => (d.goals?.length ?? 0) > 0,
    Body: GoalsBody,
  },
];

/** Questions planned in total, so progress is honest from the first one. */
export const QUESTION_COUNT = 7;
