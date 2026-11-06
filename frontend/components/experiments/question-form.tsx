import { useId, type RefObject } from "react";
import { button } from "@/components/ui/button";

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  question: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  blocked: boolean;
  hideSubmit?: boolean;
  headingLevel: 1 | 2;
  suggestions?: string[];
  onSuggestion?: (question: string) => void;
};

/** The same native form and validation on Your lab and the dedicated question page. */
export function QuestionForm({
  inputRef,
  question,
  onChange,
  onSubmit,
  busy,
  blocked,
  hideSubmit = false,
  headingLevel,
  suggestions = [],
  onSuggestion,
}: Props) {
  const id = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const length = question.trim().length;

  return (
    <>
      <p className="text-caption text-moss">A little curiosity, a little evidence</p>
      <Heading className="mt-3 font-display text-display-sm tracking-tight sm:text-display">
        Ask a question.
      </Heading>
      <p className="mt-4 text-lead text-ink">
        What have you been wondering about your daily habits? Let&apos;s turn it into something you can test.
      </p>
      <form
        className="mt-8 max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor={id} className="block font-medium">Your question or goal</label>
        <textarea
          ref={inputRef}
          id={id}
          required
          minLength={5}
          maxLength={500}
          disabled={busy}
          value={question}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-help ${id}-count`}
          rows={4}
          placeholder="Does walking after dinner improve my sleep?"
          className="mt-3 w-full resize-y rounded-control border border-control bg-paper p-4 text-body placeholder:text-muted disabled:opacity-70"
        />
        <div className="mt-2 flex justify-between gap-4 text-caption text-muted">
          <p id={`${id}-help`}>5–500 characters. One small change at a time.</p>
          <span id={`${id}-count`} className="font-mono">{question.length}/500</span>
        </div>
        {suggestions.length > 0 && (
          <div role="group" aria-label="Suggestions" className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={busy}
                onClick={() => onSuggestion?.(suggestion)}
                className="min-h-11 rounded-pill bg-accent-tint px-4 py-2 text-left text-body text-ink transition-[scale] duration-[var(--motion-press)] hover:text-accent active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {!hideSubmit && <button
          type="submit"
          disabled={busy || blocked || length < 5 || length > 500}
          className={`${button("primary")} mt-6`}
        >
          {busy ? "Shaping your experiment…" : "Design experiment"}
        </button>}
      </form>
    </>
  );
}
