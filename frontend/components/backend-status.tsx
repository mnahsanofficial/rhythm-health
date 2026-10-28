"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";

type State = "checking" | "ok" | "down";

export function BackendStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    apiGet<{ status: string }>("/health")
      .then((r) => setState(r.status === "ok" ? "ok" : "down"))
      .catch(() => setState("down"));
  }, []);

  const label = {
    checking: "Checking backend…",
    ok: "Backend connected",
    down: "Backend unreachable",
  }[state];

  return (
    <p className="text-sm text-zinc-500" role="status">
      {label}
    </p>
  );
}
