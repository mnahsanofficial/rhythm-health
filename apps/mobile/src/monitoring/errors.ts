/** Privacy boundary shared by automatic JS errors and the explicit drill. */
type Event = { [key: string]: unknown; message?: string };
export function scrubEvent(event: Event): Event {
  const clean: Event = {};
  for (const key of ['event_id', 'timestamp', 'platform', 'level', 'release', 'environment']) {
    if (key in event) clean[key] = event[key];
  }
  const exception = event.exception as { values?: { value?: string }[] } | undefined;
  const message = event.message ?? exception?.values?.[0]?.value;
  clean.message = message === 'Rhythm mobile failure drill' ? message : 'Unhandled mobile error';
  return clean;
}

type Reporter = { init: (options: Record<string, unknown>) => unknown };
export function startErrorReporting(dsn: string | undefined, load: () => Reporter, expoGo = true,
  release?: string, environment = 'development'): boolean {
  if (!dsn?.trim()) return false;
  try {
    load().init({ dsn: dsn.trim(), enableNative: !expoGo, sendDefaultPii: false,
      release, environment, tracesSampleRate: 0, maxBreadcrumbs: 0,
      enableAutoSessionTracking: false, beforeSend: scrubEvent,
      sendClientReports: false, attachStacktrace: false,
    });
    return true;
  } catch { return false; }
}

export function drillEnabled(development: boolean, optIn: string | undefined): boolean {
  return development && optIn === '1';
}
