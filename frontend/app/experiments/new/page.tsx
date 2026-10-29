import type { Metadata } from "next";
import { NewExperiment } from "@/components/experiments/new-experiment";

export const metadata: Metadata = { title: "Ask a question · Rhythm" };

export default async function NewExperimentPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string | string[] }>;
}) {
  const { question } = await searchParams;
  const initialQuestion = typeof question === "string" ? question.trim() : "";

  return <NewExperiment initialQuestion={initialQuestion} />;
}
