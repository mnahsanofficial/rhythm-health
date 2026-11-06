"use client";
import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { captureException(error); }, [error]);
  return <html><body><h1>Something went wrong.</h1><p>Please try again.</p><button onClick={reset}>Try again</button></body></html>;
}
