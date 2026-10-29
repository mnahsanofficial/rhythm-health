"use client";

import { MOTION_DURATION } from "@/lib/motion";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

type Option<T extends string> = { value: T; label: string; hint?: string };

type Props<T extends string> = {
  legend: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
};

/**
 * Single choice. Native radios underneath (arrow keys, screen readers, form submit),
 * styled as cards. The selected highlight glides between options so the change is visible.
 */
export function ChoiceGroup<T extends string>({ legend, options, value, onChange }: Props<T>) {
  const name = useId();
  const reduce = useReducedMotion();

  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            // Press feedback is CSS, not motion's whileTap: whileTap makes the label focusable,
            // which steals focus from the radio and breaks arrow keys.
            <label
              key={option.value}
              className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 transition-[scale] duration-[var(--motion-press)] active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-moss"
            >
              {selected && (
                <motion.span
                  layoutId={reduce ? undefined : `${name}-selected`}
                  className="absolute inset-0 rounded-card border-2 border-moss bg-moss-tint"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="relative flex-1">
                <span className="block text-lead text-ink">{option.label}</span>
                {option.hint && <span className="block text-caption text-muted">{option.hint}</span>}
              </span>
              <span
                aria-hidden="true"
                className={`relative grid size-6 place-items-center rounded-full border-2 ${
                  selected ? "border-moss bg-moss" : "border-line bg-paper"
                }`}
              >
                <svg viewBox="0 0 16 16" className="size-3.5">
                  <motion.path
                    d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                    fill="none"
                    stroke="var(--color-paper)"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ opacity: selected ? 1 : 0 }}
                    transition={{ duration: reduce ? 0 : MOTION_DURATION.press, ease: "easeOut" }}
                  />
                </svg>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
