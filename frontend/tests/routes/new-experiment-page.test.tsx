import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import NewExperimentPage from "@/app/experiments/new/page";

vi.mock("@/components/experiments/new-experiment", () => ({ NewExperiment: () => <p>Question entry</p> }));

it("serves a loading shell while the request's question is still unavailable", () => {
  const searchParams = new Promise<{ question?: string | string[] }>(() => {});
  const shell = renderToString(<NewExperimentPage searchParams={searchParams} />);
  expect(shell).toContain('role="status"');
  expect(shell).toContain("Loading your experiment");
  expect(shell).not.toContain("Question entry");
});
