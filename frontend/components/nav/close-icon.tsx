/** The × used to close flows. Its button carries the name. */
export function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export const closeButton =
  "grid min-h-11 min-w-11 place-items-center rounded-pill text-ink transition-colors duration-[var(--motion-press)] hover:bg-line/60";
