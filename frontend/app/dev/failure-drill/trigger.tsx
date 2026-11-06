"use client";
export function FailureDrill() {
  return <button onClick={() => { throw new Error("Rhythm web failure drill"); }}>Trigger monitoring test error</button>;
}
