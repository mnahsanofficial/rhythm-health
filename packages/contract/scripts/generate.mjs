import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { syncArtifacts } from "./artifacts.mjs";

const directory = fileURLToPath(new URL("..", import.meta.url));
const root = resolve(directory, "../..");
const check = process.argv.includes("--check");

try {
  // Use uv sync's interpreter directly: no uv/npm network or project dotenv loading.
  // Deliberately do not inherit Supabase/OpenRouter settings from the shell.
  const result = spawnSync(
    resolve(root, "backend/.venv/bin/python"),
    ["-I", resolve(directory, "scripts/export-openapi.py")],
    { cwd: directory, encoding: "utf8", env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1" } },
  );
  if (result.error) throw new Error("Backend interpreter unavailable. Run cd backend && uv sync first.");
  if (result.status !== 0) throw new Error(`OpenAPI export failed: ${result.stderr}`);
  const schema = JSON.parse(result.stdout);
  const types = astToString(await openapiTS(schema));
  await syncArtifacts(directory, {
    "openapi.json": `${JSON.stringify(schema, null, 2)}\n`,
    "src/generated.ts": `// Generated from FastAPI. Run npm run contract:generate; do not edit.\n${types}`,
  }, { check });
  console.log(check ? "Contract schema and types are current." : "Generated contract schema and types.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
