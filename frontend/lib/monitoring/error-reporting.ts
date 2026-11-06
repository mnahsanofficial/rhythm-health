/** Sentry 11 uses dataCollection rather than sendDefaultPii. Disable collection at source too. */
export const DATA_COLLECTION = {
  userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
  graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
  stackFrameVariables: false, frameContextLines: 0,
};
export const errorOnlyIntegrations = <T extends { name: string }>(defaults: T[]) => defaults.filter(i => !["BrowserSession", "BrowserTracing", "Breadcrumbs"].includes(i.name));
const ERROR_TITLES = ["Rhythm web failure drill", "Unhandled application error"];
type Event = { [key: string]: unknown; message?: string; release?: string; environment?: string };
export function scrubEvent(input: object): import("@sentry/nextjs").ErrorEvent {
  const event = input as Event;
  const clean: Event & { type: undefined } = { type: undefined };
  for (const key of ["event_id", "timestamp", "platform", "level", "release", "environment"]) {
    if (key in event) clean[key] = event[key];
  }
  const exception = event.exception as { values?: { value?: string }[] } | undefined;
  const message = event.message ?? exception?.values?.[0]?.value;
  clean.message = ERROR_TITLES.includes(message ?? "") ? message : "Unhandled application error";
  return clean as import("@sentry/nextjs").ErrorEvent;
}

type Reporter = { init: (options: Record<string, unknown>) => unknown };
export async function startErrorReporting(dsn: string | undefined, load: () => Promise<Reporter>): Promise<boolean> {
  const value = dsn?.trim();
  if (!value) return false;
  try {
    const reporter = await load();
    reporter.init({ dsn: value, dataCollection: DATA_COLLECTION, tracesSampleRate: 0,
      environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      maxBreadcrumbs: 0, integrations: errorOnlyIntegrations, beforeSend: scrubEvent, beforeSendTransaction: () => null,
      sendClientReports: false,
    });
    return true;
  } catch { return false; }
}
