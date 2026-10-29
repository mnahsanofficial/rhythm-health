import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperimentDetail, ExperimentDetailSkeleton } from "@/components/experiments/experiment-detail";

export const metadata: Metadata = { title: "Your experiment · Rhythm" };

// The id is only known per request, so it's read inside Suspense (Cache Components rule).
export default function ExperimentPage({ params }: PageProps<"/experiments/[id]">) {
  return (
    <Suspense fallback={<ExperimentDetailSkeleton />}>
      {params.then(({ id }) => (
        <ExperimentDetail key={id} id={id} />
      ))}
    </Suspense>
  );
}
