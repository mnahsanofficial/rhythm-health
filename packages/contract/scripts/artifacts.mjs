import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Write generated artifacts, or verify them without changing the checkout. */
export async function syncArtifacts(directory, artifacts, { check = false } = {}) {
  if (check) {
    const stale = [];
    for (const [name, contents] of Object.entries(artifacts)) {
      try {
        if (await readFile(join(directory, name), "utf8") !== contents) stale.push(name);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        stale.push(name);
      }
    }
    if (stale.length) {
      throw new Error(`Stale contract files: ${stale.join(", ")}. Run npm run contract:generate.`);
    }
    return;
  }
  for (const [name, contents] of Object.entries(artifacts)) {
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
}
