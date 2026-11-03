import type { Metadata } from "next";
import { CombinedCheckin } from "@/components/checkins/combined-checkin";

export const metadata: Metadata = { title: "Today's check-in · Rhythm" };

export default function TodayCheckInPage() {
  return <CombinedCheckin />;
}
