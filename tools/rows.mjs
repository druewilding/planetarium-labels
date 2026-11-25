// Step 1: download each region's extract from Geofabrik, keep what's worth a
// label, and write it to rows/<region>.ndjson, one row per line.
// Usage: npm run rows [-- europe/norway …] (default: regions.json)
//        --fresh   download the extracts again, even if they're in the cache
//        --tidy    delete each extract once its rows are written (to save disk)
//
// Needs osmium (brew install osmium-tool, or apt install osmium-tool) and curl.

import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { OSMIUM_FILTER, toRow } from "../src/labels.js";
import { cacheDir, parseArgs, rowsDir, slug } from "./regions.mjs";

const run = (cmd, ...args) => execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });

/** Download a region's extract, unless it's already in the cache. */
function download(region, fresh) {
  const file = `${cacheDir}/${slug(region)}.osm.pbf`;
  if (existsSync(file) && !fresh) return file;
  const url = `https://download.geofabrik.de/${region}-latest.osm.pbf`;
  console.log(`Downloading ${url}`);
  // curl, for retrying and carrying on where a dropped download stopped.
  const retry = ["--retry", "5", "--retry-all-errors", "-C", "-"];
  run("curl", "-fsSL", ...retry, "-A", "planetarium-labels", "-o", `${file}.part`, url);
  renameSync(`${file}.part`, file);
  return file;
}

/** Write the rows for everything worth a label in one extract; returns how many. */
async function writeRows(extract, out) {
  const filtered = extract.replace(/\.osm\.pbf$/, ".labels.osm.pbf");
  const exported = extract.replace(/\.osm\.pbf$/, ".labels.geojsonseq");
  // Two passes over the extract: the things, then the points of any outlines.
  run("osmium", "tags-filter", extract, ...OSMIUM_FILTER, "-o", filtered, "--overwrite");
  run("osmium", "export", filtered, "-f", "geojsonseq", "--attributes", "type,id", "-o", exported, "--overwrite");
  const file = createWriteStream(`${out}.part`);
  let count = 0;
  for await (const line of createInterface({ input: createReadStream(exported) })) {
    const json = line.replace(/^\x1e/, ""); // record separators between features
    if (!json.trim()) continue;
    const row = toRow(JSON.parse(json));
    if (!row) continue;
    if (!file.write(`${JSON.stringify(row)}\n`)) await once(file, "drain");
    count++;
  }
  file.end();
  await once(file, "finish");
  renameSync(`${out}.part`, out);
  rmSync(filtered, { force: true });
  rmSync(exported, { force: true });
  return count;
}

/** Build the rows for each region in turn. */
export async function buildRows(regions, { fresh = false, tidy = false } = {}) {
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(rowsDir, { recursive: true });
  for (const region of regions) {
    const started = Date.now();
    const extract = download(region, fresh);
    const count = await writeRows(extract, `${rowsDir}/${slug(region)}.ndjson`);
    // A region with nothing in it means something went wrong, not that it's empty.
    if (!count) throw new Error(`No labels in ${region}`);
    if (tidy) rmSync(extract);
    console.log(`${region}: ${count} labels (${Math.round((Date.now() - started) / 1000)} s)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { regions, flags } = parseArgs();
  await buildRows(regions, { fresh: flags.has("--fresh"), tidy: flags.has("--tidy") });
}
