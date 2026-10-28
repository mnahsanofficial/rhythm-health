"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";

type Props = {
  legend: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Most the user can pick. Unpicked chips are disabled once it's reached. */
  max?: number;
  addLabel: string;
  addPlaceholder: string;
};

const MAX_CUSTOM_LENGTH = 60;

/**
 * Multiple choice as chips, plus "add your own". Native checkboxes underneath for keyboard
 * and screen readers. Picked chips fill in and grow a tick; added chips pop into the list.
 */
export function ChipPicker({ legend, options, value, onChange, max, addLabel, addPlaceholder }: Props) {
  const inputId = useId();
  const [custom, setCustom] = useState("");
  // Anything picked that isn't a preset was typed by the user; show it as its own chip.
  const chips = [...options, ...value.filter((v) => !options.includes(v))];
  const full = max !== undefined && value.length >= max;

  const toggle = (chip: string) =>
    onChange(value.includes(chip) ? value.filter((v) => v !== chip) : [...value, chip]);

  const add = () => {
    const text = custom.trim().replace(/\s+/g, " ");
    if (!text || full) return;
    const existing = chips.find((c) => c.toLowerCase() === text.toLowerCase());
    if (existing) {
      if (!value.includes(existing)) onChange([...value, existing]);
    } else {
      onChange([...value, text.charAt(0).toUpperCase() + text.slice(1)]);
    }
    setCustom("");
  };

  return (
    <div>
      <fieldset>
        <legend className="sr-only">{legend}</legend>
        <motion.div layout className="flex flex-wrap gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {chips.map((chip) => {
              const picked = value.includes(chip);
              const disabled = full && !picked;
              return (
                <motion.label
                  layout
                  key={chip}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: disabled ? 0.45 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className={`flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-body transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-moss ${
                    picked
                      ? "border-moss bg-moss text-paper"
                      : "border-line bg-paper text-ink hover:border-muted"
                  } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={picked}
                    disabled={disabled}
                    onChange={() => toggle(chip)}
                    className="sr-only"
                  />
                  <AnimatePresence initial={false}>
                    {picked && (
                      <motion.svg
                        key="tick"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="size-4 shrink-0"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 16, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <path
                          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.25}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                  {chip}
                </motion.label>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </fieldset>

      {max !== undefined && (
        <p aria-live="polite" className="mt-3 text-caption text-muted">
          {value.length} of {max} picked{full ? ". Unpick one to choose another." : ""}
        </p>
      )}

      <div className="mt-6">
        <label htmlFor={inputId} className="text-caption font-medium text-ink">
          {addLabel}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id={inputId}
            type="text"
            value={custom}
            maxLength={MAX_CUSTOM_LENGTH}
            placeholder={addPlaceholder}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the chip instead of submitting the whole step.
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="min-h-12 min-w-0 flex-1 rounded-card border border-line bg-paper px-4 text-lead text-ink placeholder:text-muted/70 focus-visible:border-moss"
          />
          <button
            type="button"
            onClick={add}
            disabled={full || !custom.trim()}
            className="min-h-12 shrink-0 rounded-pill bg-moss-tint px-5 text-body font-medium text-moss transition-colors hover:bg-moss hover:text-paper disabled:opacity-40 disabled:hover:bg-moss-tint disabled:hover:text-moss"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
