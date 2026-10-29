import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckinForm, CheckinSkeleton } from "@/components/checkins/checkin-form";

export const metadata: Metadata = { title: "Today's check-in · Rhythm" };

// The id is only known per request, so it's read inside Suspense (Cache Components rule).
export default function CheckInPage({ params }: PageProps<"/experiments/[id]/check-in">) {
  return (
    <Suspense fallback={<CheckinSkeleton />}>
      {params.then(({ id }) => (
        <CheckinForm key={id} id={id} />
      ))}
    </Suspense>
  );
}
