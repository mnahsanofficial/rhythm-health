/**
 * Button looks, for <button> and <Link> alike. Every button fits its words and is at least 48px high.
 * One `primary` per screen. Only the single primary pinned to the bottom of a phone may add `w-full sm:w-fit`.
 */
const base =
  "inline-flex min-h-12 w-fit max-w-[var(--button-max)] items-center justify-center rounded-pill px-6 text-center font-medium transition-[background-color,border-color,color,scale] duration-[var(--motion-press)] ease-[var(--ease-settle)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:active:scale-100";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-press disabled:border disabled:border-line disabled:bg-paper disabled:text-muted",
  secondary: "border border-control text-ink hover:border-ink hover:bg-line/50 disabled:border-line disabled:text-muted disabled:hover:bg-transparent",
  quiet: "text-ink hover:bg-line/60 disabled:text-muted disabled:hover:bg-transparent",
} as const;

export function button(variant: keyof typeof VARIANTS) {
  return `${base} ${VARIANTS[variant]}`;
}
