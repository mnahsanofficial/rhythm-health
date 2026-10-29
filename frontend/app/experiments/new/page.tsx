import type { Metadata } from "next";
import { Suspense } from "react";
import { NewExperiment } from "@/components/experiments/new-experiment";

export const metadata: Metadata = { title: "Ask a question · Rhythm" };

type Props = { searchParams: Promise<{ question?: string | string[] }> };

export default function NewExperimentPage(props: Props) {
  return (
    <Suspense fallback={<QuestionSkeleton />}>
      <QuestionFromRequest {...props} />
    </Suspense>
  );
}

/** URL data is request-specific; keep its read inside the streaming boundary. */
async function QuestionFromRequest({ searchParams }: Props) {
  const { question } = await searchParams;
  const initialQuestion = typeof question === "string" ? question.trim() : "";
  return <NewExperiment initialQuestion={initialQuestion} />;
}

function QuestionSkeleton() {
  return (
    <div role="status" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-8">
      <span className="sr-only">Loading your experiment</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="h-5 w-24 rounded-pill bg-line" />
        <div className="h-12 w-3/4 rounded-pill bg-line" />
        <div className="h-56 rounded-card bg-paper" />
        <div className="h-12 w-48 rounded-pill bg-line" />
      </div>
    </div>
  );
}
