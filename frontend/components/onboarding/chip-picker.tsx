"use client";

import { useId, useState } from "react";

type Props = {
  legend: string;
  groups?: { label: string; options: string[] }[];
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
export function ChipPicker({ legend, options, value, onChange, max, addLabel, addPlaceholder, groups }: Props) {
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
        <div className="space-y-5">
          {(groups ? [...groups, { label: "Your own habits", options: chips.filter(c => !options.includes(c)) }] : [{ label: "", options: chips }])
            .filter(group => group.options.length > 0)
            .map(group => (
              <div key={group.label}>
                {group.label && <h2 className="mb-2 font-display text-title">{group.label}</h2>}
                <div className="flex flex-wrap gap-2">
                  {group.options.map(chip => {
                    const picked = value.includes(chip);
                    const disabled = full && !picked;
                    return (
                      <label
                        key={chip}
                        className={`flex min-h-12 items-center gap-2 rounded-pill border px-4 text-body transition-transform active:scale-[0.98] motion-reduce:transition-none has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-moss ${picked ? "border-moss bg-moss text-paper" : "border-line bg-paper text-ink hover:border-muted"} ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                      >
                        <input type="checkbox" checked={picked} disabled={disabled} onChange={() => toggle(chip)} className="sr-only" />
                        <svg
                          viewBox="0 0 16 16" aria-hidden="true"
                          className={`size-4 shrink-0 transition-[transform,opacity] duration-150 motion-reduce:transition-none ${picked ? "scale-100 opacity-100" : "scale-75 opacity-30"}`}
                        >
                          {picked ? <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" /> : <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" />}
                        </svg>
                        {chip}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </fieldset>

      {/* A small limit is part of the question ("pick up to three"), so count it; a large one only matters once hit. */}
      {max !== undefined && (max <= 5 || full) && (
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
