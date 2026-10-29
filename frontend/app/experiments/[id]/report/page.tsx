import type { Metadata } from "next";
import { Suspense } from "react";
import { LabReport, LabReportSkeleton } from "@/components/report/lab-report";

export const metadata: Metadata = { title: "Lab Report · Rhythm" };

// The id is only known per request, so it's read inside Suspense (Cache Components rule).
export default function ReportPage({ params }: PageProps<"/experiments/[id]/report">) {
  return (
    <Suspense fallback={<LabReportSkeleton />}>
      {params.then(({ id }) => (
        <LabReport key={id} id={id} />
      ))}
    </Suspense>
  );
}
