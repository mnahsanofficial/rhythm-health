import type { Metadata } from "next";
import { DemoEntry } from "@/components/demo-entry";

export const metadata: Metadata = { title: "Demo · Rhythm" };

export default function DemoPage() {
  return (
    <div className="page-frame py-10 [--frame:48rem]">
      <h1 className="font-display text-display-sm tracking-tight">Explore a sample experiment.</h1>
      <p className="mt-4 text-lead text-muted">See how a completed experiment becomes a Lab Report. The demo uses labelled sample data.</p>
      <DemoEntry />
    </div>
  );
}
