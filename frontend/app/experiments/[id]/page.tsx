import type { Metadata } from "next";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";

export const metadata: Metadata = { title: "Your experiment · Rhythm" };

export default async function ExperimentPage({ params }: PageProps<"/experiments/[id]">) {
  const { id } = await params;
  return <ExperimentDetail key={id} id={id} />;
}
