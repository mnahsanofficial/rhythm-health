import { useId, type RefObject } from "react";

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  question: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  checkingActive: boolean;
  blocked: boolean;
  headingLevel: 1 | 2;
};

/** The same native form and validation on Your lab and the dedicated question page. */
export function QuestionForm({
  inputRef,
  question,
  onChange,
  onSubmit,
  busy,
  checkingActive,
  blocked,
  headingLevel,
}: Props) {
  const id = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const length = question.trim().length;

  return (
    <>
      <p className="font-mono text-caption text-moss">A little curiosity, a little evidence</p>
      <Heading className="mt-3 font-display text-display-sm tracking-tight sm:text-display">
        Ask a question.
      </Heading>
      <p className="mt-4 text-lead text-muted">
        What have you been wondering about your daily habits? Let&apos;s turn it into something you can test.
      </p>
      <form
        className="mt-8"
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
          className="mt-3 w-full resize-y rounded-card border border-line bg-paper p-4 text-body placeholder:text-muted disabled:opacity-70"
        />
        <div className="mt-2 flex justify-between gap-4 text-caption text-muted">
          <p id={`${id}-help`}>5–500 characters. One small change at a time.</p>
          <span id={`${id}-count`} className="font-mono">{question.length}/500</span>
        </div>
        <button
          type="submit"
          disabled={busy || blocked || length < 5 || length > 500}
          className="mt-5 min-h-12 w-full rounded-pill bg-moss px-6 py-3 font-medium text-paper transition-transform duration-[var(--motion-press)] hover:bg-moss-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:w-auto"
        >
          {checkingActive ? "Checking your experiment…" : busy ? "Shaping your experiment…" : "Design my experiment"}
        </button>
      </form>
    </>
  );
}
