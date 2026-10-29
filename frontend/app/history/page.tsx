import type { Metadata } from "next";
import { ExperimentHistory } from "@/components/experiments/experiment-history";

export const metadata: Metadata = { title: "Experiment history · Rhythm" };

export default function HistoryPage() {
  return <ExperimentHistory />;
}
