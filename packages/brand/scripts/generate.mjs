import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderCss } from "./css.mjs";

export async function generate({
  tokensPath = new URL("../src/tokens.json", import.meta.url),
  outputPath = new URL("../generated/tokens.css", import.meta.url),
  check = false,
} = {}) {
  const css = renderCss(JSON.parse(await readFile(tokensPath, "utf8")));
  if (check) {
    let current;
    try {
      current = await readFile(outputPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current !== css) throw new Error("Stale brand CSS. Run npm run brand:generate.");
    return;
  }
  await mkdir(dirname(outputPath instanceof URL ? fileURLToPath(outputPath) : outputPath), { recursive: true });
  await writeFile(outputPath, css);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await generate({ check: process.argv.includes("--check") });
    console.log(process.argv.includes("--check") ? "Brand CSS is current." : "Generated brand CSS.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
