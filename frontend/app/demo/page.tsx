import type { Metadata } from "next";
import Link from "next/link";
import { DemoEntry } from "@/components/demo-entry";

export const metadata: Metadata = { title: "Demo · Rhythm" };

export default function DemoPage() {
  return (
    <div className="page-frame py-10 [--frame:48rem]">
      <Link href="/" className="inline-flex min-h-11 items-center text-moss hover:underline">← Your lab</Link>
      <h1 className="mt-5 font-display text-display-sm tracking-tight">Explore a sample experiment.</h1>
      <p className="mt-4 text-lead text-muted">See how a completed experiment becomes a Lab Report. The demo uses labelled sample data.</p>
      <DemoEntry />
    </div>
  );
}
