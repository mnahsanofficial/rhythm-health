"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyTheme, readThemeChoice, saveThemeChoice, watchSystemTheme, type ThemeChoice } from "@/lib/theme";

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const changeListeners = new Set<() => void>();
function subscribe(listener: () => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}
function setChoice(choice: ThemeChoice) {
  const saved = saveThemeChoice(choice);
  changeListeners.forEach(listener => listener());
  return saved;
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      {choice === "light" && (
        <>
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
        </>
      )}
      {choice === "dark" && <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" />}
      {choice === "system" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

/** Light, dark or system, remembered on this device. Follows the system until someone chooses. */
export function ThemeControl() {
  const choice = useSyncExternalStore(subscribe, readThemeChoice, () => "system" as const);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Before paint, because React's development remount clears what the head script set on <html>.
  useLayoutEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [choice]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = CHOICES.find(({ value }) => value === choice)!;

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Theme: ${current.label}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(value => !value)}
        className="grid min-h-11 min-w-11 place-items-center rounded-pill text-muted transition-colors duration-[var(--motion-press)] hover:bg-line/60 hover:text-ink"
      >
        <ThemeIcon choice={choice} />
      </button>
      {open && (
        <fieldset id={panelId} className="absolute top-full right-0 z-50 mt-2 w-44 rounded-card border border-line bg-raised p-2">
          <legend className="sr-only">Theme</legend>
          {CHOICES.map(({ value, label }) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-body text-ink hover:bg-oat">
              <input
                type="radio"
                name={`${panelId}-theme`}
                value={value}
                checked={choice === value}
                onChange={() => setSaveFailed(!setChoice(value))}
                className="size-4 accent-[var(--color-accent)]"
              />
              {label}
            </label>
          ))}
          {saveFailed && <p role="status" className="px-3 pt-1 pb-2 text-caption text-muted">Applied, but this browser couldn&apos;t remember it.</p>}
        </fieldset>
      )}
    </div>
  );
}
