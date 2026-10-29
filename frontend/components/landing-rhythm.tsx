"use client";

import { useState } from "react";
import { RhythmRing } from "@/components/rhythm-ring";
import { placeHabits } from "@/lib/rhythm/habits";
import type { Profile } from "@/lib/types/api";

/** An explorable sample, kept separate from onboarding drafts and account data. */
export function LandingRhythm({ profile }: { profile: Profile }) {
  const [selected, setSelected] = useState(profile.regular_habits);
  const habits = placeHabits(selected, profile.usual_sleep_schedule);
  const options = placeHabits(profile.regular_habits, profile.usual_sleep_schedule);
  const { bedtime, wake_time } = profile.usual_sleep_schedule;

  return (
    <figure className="rounded-card bg-paper p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
        <h2 className="font-display text-title">A day, made visible.</h2>
        <span className="font-mono text-caption text-muted">Sample rhythm</span>
      </div>
      <div className="mx-auto my-3 max-w-[260px]">
        <RhythmRing schedule={profile.usual_sleep_schedule} sleepHours={profile.usual_sleep_hours} habits={habits} />
      </div>
      <dl className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
        <dt className="flex items-center gap-2 text-body text-muted">
          <span aria-hidden="true" className="size-2.5 rounded-pill bg-night" />Sleep window
        </dt>
        <dd className="font-mono text-body tabular-nums">{bedtime}–{wake_time}</dd>
      </dl>
      <fieldset>
        <legend className="text-body font-medium">Try changing this example</legend>
        <p className="mt-1 text-caption text-muted">Add or remove a habit to see its place in the day.</p>
        <div className="mt-3 divide-y divide-line">
          {options.map(habit => {
            const checked = selected.includes(habit.label);
            return (
              <label
                key={habit.label}
                className="flex min-h-11 cursor-pointer items-center gap-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelected(values => checked ? values.filter(value => value !== habit.label) : [...values, habit.label])}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-pill border ${checked ? "border-moss bg-moss text-paper" : "border-muted text-muted"}`}
                >
                  <svg viewBox="0 0 16 16" className={`size-4 transition-[transform,opacity] duration-[var(--motion-press)] motion-reduce:transition-none ${checked ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
                    <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1 text-body">{habit.label}</span>
                <span className="font-mono text-caption text-muted tabular-nums">{habit.time}</span>
              </label>
            );
          })}
        </div>
        <p role="status" className="mt-2 text-caption text-muted">{habits.length} {habits.length === 1 ? "habit" : "habits"} shown. Only this example changes.</p>
      </fieldset>
      <figcaption className="mt-5 border-t border-line pt-4 text-caption text-muted">
        A rhythm, shown with sample data. Yours is drawn from your own answers.
      </figcaption>
    </figure>
  );
}
