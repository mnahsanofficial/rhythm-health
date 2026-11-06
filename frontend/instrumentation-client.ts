import { startErrorReporting } from "@/lib/monitoring/error-reporting";

void startErrorReporting(process.env.NEXT_PUBLIC_SENTRY_DSN, () => import("@sentry/nextjs"));
