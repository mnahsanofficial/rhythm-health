import { afterEach, expect, it, vi } from "vitest";

const { init, captureRequestError } = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ init, captureRequestError }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("does not initialize server reporting without a DSN", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("SENTRY_DSN", "");
  const { register } = await import("../../instrumentation");
  await register();
  expect(init).not.toHaveBeenCalled();
});

it("uses explicit Next error hooks without automatic HTTP or process-session collection", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
  const { register } = await import("../../instrumentation");
  await register();
  expect(init).toHaveBeenCalledWith(expect.objectContaining({ defaultIntegrations: false }));
  const scrub = init.mock.calls[0][0].beforeSend;
  expect(JSON.stringify(scrub({ request: { data: "private-answer" }, message: "private-answer" }))).not.toContain("private-answer");
});
