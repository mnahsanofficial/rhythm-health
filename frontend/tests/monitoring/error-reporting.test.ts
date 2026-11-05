import { describe, expect, it, vi } from "vitest";
import { startErrorReporting } from "@/lib/monitoring/error-reporting";

describe("web error reporting", () => {
  it.each([undefined, "", "   "])("does nothing and loads nothing without a DSN (%j)", async (dsn) => {
    const load = vi.fn();
    await expect(startErrorReporting(dsn, load)).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("starts with a DSN and sends no personal data or traces", async () => {
    const init = vi.fn();
    await expect(startErrorReporting("https://public@example.invalid/1", async () => ({ init }))).resolves.toBe(true);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://public@example.invalid/1",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    }));
  });

  it("never breaks the app when the reporter can't load", async () => {
    await expect(startErrorReporting("https://public@example.invalid/1", () => Promise.reject(new Error("blocked")))).resolves.toBe(false);
  });
});

it("scrubs answers, URLs, tokens and exception messages before sending", async () => {
  const { scrubEvent } = await import("@/lib/monitoring/error-reporting");
  const secret = "private-health-answer";
  const clean = scrubEvent({
    event_id: "id", environment: "development", release: "abc123",
    request: { url: `http://localhost/${secret}`, data: secret },
    user: { id: secret }, extra: { note: secret }, breadcrumbs: [{ message: secret }],
    exception: { values: [{ type: "Error", value: secret, stacktrace: { frames: [{ filename: `/${secret}`, vars: { note: secret } }] } }] },
  });
  expect(JSON.stringify(clean)).not.toContain(secret);
  expect(clean.release).toBe("abc123");
});
