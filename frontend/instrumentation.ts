export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    const { scrubEvent, DATA_COLLECTION } = await import("./lib/monitoring/error-reporting");
    Sentry.init({ defaultIntegrations: false, dsn: process.env.SENTRY_DSN, dataCollection: DATA_COLLECTION, tracesSampleRate: 0,
      environment: process.env.APP_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE, maxBreadcrumbs: 0,
      beforeSend: scrubEvent, sendClientReports: false,
    });
  }
}

export const onRequestError = async (...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
