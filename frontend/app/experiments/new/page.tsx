import type { Metadata } from "next";
import { NewExperiment } from "@/components/experiments/new-experiment";

export const metadata: Metadata = { title: "Ask a question · Rhythm" };

export default function NewExperimentPage() {
  return <NewExperiment />;
}
