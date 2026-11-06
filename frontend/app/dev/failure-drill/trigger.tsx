"use client";
import { useState } from "react";
import { supabase } from "@/lib/auth/supabase";
import type { Experiment, ProposeResponse } from "@rhythm-health/contract";

const QUESTION = "Monitoring drill: Does a short evening walk change my energy?";
type Result = { label: string; status: number; requestId: string; message: string };

/** Dev-only controls keep tokens inside the normal browser SDK/request path. */
export function FailureDrill() {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function call<T>(label: string, method: string, path: string, body?: unknown): Promise<T> {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (new URL(base).port !== "8106") throw new Error("Use the isolated backend on port 8106.");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) throw new Error("Sign in to the test account first.");
    const response = await fetch(base + path, { method,
      headers: { Authorization: `Bearer ${auth.session.access_token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    const message = response.ok ? "Action succeeded" : response.status === 422 ? "Some answers need another look." :
      typeof data?.detail === "string" ? data.detail : typeof data?.detail?.message === "string" ? data.detail.message : "Request failed";
    setResults(previous => [...previous, {label, status: response.status, requestId: response.headers.get("X-Request-ID") ?? "unavailable", message}]);
    if (!response.ok) throw new Error("Drill request completed with an expected failure.");
    return data as T;
  }
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setNotice("");
    try { await action(); } catch { setNotice("Action finished. Review the result below; no credentials or response payloads are displayed."); }
    finally { setBusy(false); }
  }
  async function testExperiment(): Promise<Experiment | undefined> {
    const rows = await call<Experiment[]>("Load monitoring test", "GET", "/api/experiments?status=active");
    return rows.find(row => !row.is_seeded && row.question === QUESTION);
  }
  async function createTest() {
    if (await testExperiment()) { setNotice("The monitoring test experiment is already active."); return; }
    const result = await call<ProposeResponse>("Design local test plan", "POST", "/api/experiments/propose", {question: QUESTION});
    if (result.proposal?.question !== QUESTION || !result.prediction) throw new Error("Expected the fixed local-stub plan.");
    const saved = await call<Experiment>("Save test plan", "POST", "/api/experiments", {
      category: result.classification.category, proposal: result.proposal, prediction: result.prediction,
    });
    await call("Start test experiment", "POST", `/api/experiments/${saved.id}/start`, {});
  }
  async function saveTest() {
    const experiment = await testExperiment();
    if (!experiment) { setNotice("Create the labelled non-sample monitoring test first."); return; }
    await call("Save synthetic test check-in", "POST", `/api/experiments/${experiment.id}/checkins`, {
      metric_values: {drill_energy: 5}, intervention_completed: false, note: "Monitoring drill: synthetic test-account values.",
    });
  }
  return <main style={{padding:24}}><h1>Monitoring failure drill</h1>
    <p>Test account only. Backend port 8106 uses a local provider stub. No paid AI calls.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
      <button disabled={busy} onClick={() => void perform(() => call("Backend crash", "GET", "/api/dev/failure-drill"))}>Test backend crash</button>
      <button disabled={busy} onClick={() => void perform(() => call("AI proposal", "POST", "/api/experiments/propose", {question:QUESTION}))}>Test AI response</button>
      <button disabled={busy} onClick={() => void perform(() => call("Invalid check-in", "POST", "/api/checkins/today", {unexpected:true}))}>Test invalid check-in</button>
      <button disabled={busy} onClick={() => void perform(() => call("Database read", "GET", "/api/profile"))}>Test database read</button>
      <button disabled={busy} onClick={() => void perform(createTest)}>Create local-stub test experiment</button>
      <button disabled={busy} onClick={() => void perform(saveTest)}>Save synthetic test check-in</button>
      <button disabled={busy} onClick={() => { throw new Error("Rhythm web failure drill"); }}>Trigger monitoring test error</button>
    </div>
    <p role="status">{busy ? "Running one action…" : notice}</p>
    <table><caption>Drill responses — request IDs can be matched to backend logs and Sentry.</caption>
      <thead><tr><th>Action</th><th>Status</th><th>Request ID</th><th>User message</th></tr></thead>
      <tbody>{results.map((result,index) => <tr key={index}><td>{result.label}</td><td>{result.status}</td><td>{result.requestId}</td><td>{result.message}</td></tr>)}</tbody>
    </table>
  </main>;
}
