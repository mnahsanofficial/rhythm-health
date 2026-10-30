import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { syncArtifacts } from "../scripts/artifacts.mjs";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "rhythm-contract-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const artifacts = { "openapi.json": '{"openapi":"3.1.0"}\n', "src/generated.ts": "export interface paths {}\n" };

test("generation writes the schema and types, creating directories", async (t) => {
  const directory = await temporaryDirectory(t);
  await syncArtifacts(directory, artifacts);
  for (const [name, contents] of Object.entries(artifacts)) {
    assert.equal(await readFile(join(directory, name), "utf8"), contents);
  }
});

test("check accepts current artifacts without rewriting them", async (t) => {
  const directory = await temporaryDirectory(t);
  await syncArtifacts(directory, artifacts);
  await syncArtifacts(directory, artifacts, { check: true });
});

test("check rejects stale schema and types and preserves their contents", async (t) => {
  const directory = await temporaryDirectory(t);
  await syncArtifacts(directory, artifacts);
  await writeFile(join(directory, "openapi.json"), "old schema\n");
  await writeFile(join(directory, "src/generated.ts"), "old types\n");
  await assert.rejects(syncArtifacts(directory, artifacts, { check: true }), (error) => {
    assert.match(error.message, /openapi\.json/);
    assert.match(error.message, /src\/generated\.ts/);
    assert.match(error.message, /npm run contract:generate/);
    return true;
  });
  assert.equal(await readFile(join(directory, "openapi.json"), "utf8"), "old schema\n");
  assert.equal(await readFile(join(directory, "src/generated.ts"), "utf8"), "old types\n");
});

test("check rejects missing artifacts without generating them", async (t) => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(syncArtifacts(directory, artifacts, { check: true }), /openapi\.json/);
  await assert.rejects(readFile(join(directory, "openapi.json")), { code: "ENOENT" });
});

test("check rejects a backend schema change even when stored types match", async (t) => {
  const directory = await temporaryDirectory(t);
  await syncArtifacts(directory, artifacts);
  await assert.rejects(
    syncArtifacts(directory, { ...artifacts, "openapi.json": '{"openapi":"3.1.0","paths":{"/new":{}}}\n' }, { check: true }),
    /openapi\.json/,
  );
});

test("check rejects changed generated types even when the schema matches", async (t) => {
  const directory = await temporaryDirectory(t);
  await syncArtifacts(directory, artifacts);
  await assert.rejects(
    syncArtifacts(directory, { ...artifacts, "src/generated.ts": "export interface paths { new: unknown }\n" }, { check: true }),
    /src\/generated\.ts/,
  );
});
