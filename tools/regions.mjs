// What the build scripts share: where things go, and which regions to build.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
/** Downloaded extracts. CACHE_DIR can move them to a bigger disk. */
export const cacheDir = process.env.CACHE_DIR || `${root}cache`;
/** Each region's labels, one row per line, for the site step to merge. */
export const rowsDir = `${root}rows`;
/** The files to publish. */
export const siteDir = `${root}site`;

/** "europe/norway" → "europe-norway", for file names. */
export const slug = (region) => region.replaceAll("/", "-");

/** The regions named on the command line, else the ones in regions.json; and the --flags. */
export function parseArgs(argv = process.argv.slice(2)) {
  const named = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const regions = named.length ? named : JSON.parse(readFileSync(`${root}regions.json`, "utf8"));
  return { regions, flags };
}
