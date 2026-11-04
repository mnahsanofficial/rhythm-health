type Reporter = {
  init: (options: { dsn: string; sendDefaultPii: boolean; tracesSampleRate: number }) => unknown;
};

/** Start error reporting when a DSN is set. Without one, the reporter's code is never downloaded. */
export async function startErrorReporting(dsn: string | undefined, load: () => Promise<Reporter>): Promise<boolean> {
  const value = dsn?.trim();
  if (!value) return false;
  try {
    const reporter = await load();
    reporter.init({ dsn: value, sendDefaultPii: false, tracesSampleRate: 0 });
    return true;
  } catch {
    // Reporting must never break the app, for example when a blocker stops the download.
    return false;
  }
}
