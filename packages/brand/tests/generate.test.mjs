import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generate } from "../scripts/generate.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "rhythm-brand-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tokensPath = join(directory, "tokens.json");
  const outputPath = join(directory, "generated/tokens.css");
  await writeFile(tokensPath, await readFile(new URL("../src/tokens.json", import.meta.url)));
  return { tokensPath, outputPath };
}

test("generation creates its output directory and writes usable theme CSS", async (t) => {
  const paths = await fixture(t);
  await generate(paths);
  const css = await readFile(paths.outputPath, "utf8");
  assert.match(css, /@theme \{/);
  assert.match(css, /--color-oat: #f6f3ec;/);
  await generate({ ...paths, check: true });
});

test("check rejects missing output without creating it", async (t) => {
  const paths = await fixture(t);
  await assert.rejects(generate({ ...paths, check: true }), /npm run brand:generate/);
  await assert.rejects(readFile(paths.outputPath), { code: "ENOENT" });
});

test("check rejects stale CSS without overwriting it", async (t) => {
  const paths = await fixture(t);
  await generate(paths);
  await writeFile(paths.outputPath, "stale CSS\n");
  await assert.rejects(generate({ ...paths, check: true }), /npm run brand:generate/);
  assert.equal(await readFile(paths.outputPath, "utf8"), "stale CSS\n");
});

test("check detects token edits until the CSS is regenerated", async (t) => {
  const paths = await fixture(t);
  await generate(paths);
  const tokens = JSON.parse(await readFile(paths.tokensPath, "utf8"));
  tokens.motion.durationMs.response = 300;
  await writeFile(paths.tokensPath, JSON.stringify(tokens));
  await assert.rejects(generate({ ...paths, check: true }), /Stale brand CSS/);
  await generate(paths);
  assert.match(await readFile(paths.outputPath, "utf8"), /--motion-response: 300ms;/);
  await generate({ ...paths, check: true });
});

test("generation accepts file URLs used by the package command", async (t) => {
  const { pathToFileURL } = await import("node:url");
  const paths = await fixture(t);
  await generate({ tokensPath: pathToFileURL(paths.tokensPath), outputPath: pathToFileURL(paths.outputPath) });
  assert.match(await readFile(paths.outputPath, "utf8"), /--motion-response: 280ms;/);
});
