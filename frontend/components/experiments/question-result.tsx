"use client";

import type { RefObject } from "react";
import { button } from "@/components/ui/button";
import type { ProposeResponse } from "@/lib/types/api";

type Props = {
  result: ProposeResponse;
  headingRef: RefObject<HTMLElement | null>;
  onUseSuggestion: (question: string) => void;
  onContinue: () => void;
};

/** Advice stays text. Only the server's suggested_question can fill the real question field. */
export function QuestionResult({ result, headingRef, onUseSuggestion, onContinue }: Props) {
  const habit = result.habit_check;
  const blocked = !result.safety.allowed;
  if (!habit && !blocked) return null;
  const suggestion = blocked ? result.safety.suggested_question : habit?.suggested_question;
  const message = blocked ? result.safety.reason || "This question isn't suitable for a small habit experiment." : habit!.message;
  return <section aria-label="Question result" className="mt-8 max-w-[70rem] border-t border-line pt-7">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
      <div className="min-w-0">
        <p className="text-caption">{blocked ? "A safer starting point" : "A question you can put into practice"}</p>
        <h2 ref={node => { headingRef.current = node; }} tabIndex={-1} className="mt-2 font-display text-headline tracking-tight outline-none">
          {blocked ? "Let's find a gentler experiment." : "Turn it into a habit question."}
        </h2>
        <p className="mt-4 text-body text-ink">{message}</p>
        {!blocked && <details className="mt-4"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Why a small habit? <span aria-hidden="true" className="ml-2">⌄</span></summary><p className="mt-2 text-body text-ink">Choose one small daily action and something you can notice. A short experiment can show a pattern, not proof.</p></details>}
        {blocked && !suggestion && result.safety.suggested_alternative && <p className="mt-4 text-body text-ink">{result.safety.suggested_alternative}</p>}
        {!suggestion && <p className="mt-4 text-body text-ink">Edit your question above to try a different small habit.</p>}
      </div>
      <div className="min-w-0">
        {suggestion && <div className="rounded-card border border-control bg-paper p-5 sm:p-7">
          <p className="text-caption">Suggested question</p>
          <p className="mt-3 text-lead text-ink [overflow-wrap:anywhere]">{suggestion}</p>
          <p className="mt-4 text-body text-ink">Use this to fill your question. You can edit it before choosing Design experiment.</p>
          <button type="button" onClick={() => onUseSuggestion(suggestion)} className={`${button("primary")} mt-5`}>Use this instead <span aria-hidden="true" className="ml-3">↑</span></button>
        </div>}
        {!blocked && <div className="mt-5 border-t border-line pt-5">
          <p className="text-body text-ink">Keep your original question? Rhythm can suggest a related habit to test.</p>
          <button type="button" onClick={onContinue} className={`${button("secondary")} mt-4`}>Continue anyway</button>
        </div>}
      </div>
    </div>
  </section>;
}
