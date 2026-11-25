// Builds the label squares from Geofabrik's OpenStreetMap extracts.
// Usage: npm run build [-- europe/norway europe/sweden …] (default: regions.json)
//        npm run build -- --fresh   to download the extracts again
//
// Needs osmium (brew install osmium-tool, or apt install osmium-tool). Extracts are
// kept in cache/, and the site to publish is written to site/.

import { execFileSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { OSMIUM_FILTER, squareKey, toRow } from "../src/labels.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const cache = `${root}cache`;
const site = `${root}site`;

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const named = args.filter((a) => !a.startsWith("--"));
const regions = named.length ? named : JSON.parse(readFileSync(`${root}regions.json`, "utf8"));

const osmium = (...a) => execFileSync("osmium", a, { stdio: ["ignore", "ignore", "inherit"] });

/** Download a region's extract, unless it's already in the cache. */
async function download(region) {
  const file = `${cache}/${region.replaceAll("/", "-")}.osm.pbf`;
  if (existsSync(file) && !fresh) return file;
  const url = `https://download.geofabrik.de/${region}-latest.osm.pbf`;
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "planetarium-labels" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.part`));
  execFileSync("mv", [`${file}.part`, file]);
  return file;
}

/** The rows for everything worth a label in one extract. */
async function rowsOf(extract) {
  const filtered = extract.replace(/\.osm\.pbf$/, ".labels.osm.pbf");
  const exported = extract.replace(/\.osm\.pbf$/, ".labels.geojsonseq");
  osmium("tags-filter", extract, ...OSMIUM_FILTER, "-o", filtered, "--overwrite");
  osmium("export", filtered, "-f", "geojsonseq", "--attributes", "type,id", "-o", exported, "--overwrite");
  const rows = [];
  for await (const line of createInterface({ input: createReadStream(exported) })) {
    const json = line.replace(/^\x1e/, ""); // record separators between features
    if (!json.trim()) continue;
    const row = toRow(JSON.parse(json));
    if (row) rows.push(row);
  }
  return rows;
}

mkdirSync(cache, { recursive: true });
// Keep one of each thing: neighbouring extracts overlap at their borders, and osmium
// exports a building drawn as a closed outline twice (as a line and as an area).
const byId = new Map();
for (const region of regions) {
  const extract = await download(region);
  const rows = await rowsOf(extract);
  for (const row of rows) byId.set(row[0], row);
  console.log(`${region}: ${rows.length} labels`);
}

const squares = new Map();
for (const row of byId.values()) {
  const key = squareKey(row[2], row[3]);
  if (!squares.has(key)) squares.set(key, []);
  squares.get(key).push(row);
}

rmSync(site, { recursive: true, force: true });
mkdirSync(`${site}/squares`, { recursive: true });
const counts = {};
for (const [key, rows] of [...squares].sort(([a], [b]) => a.localeCompare(b))) {
  rows.sort(([a], [b]) => a.localeCompare(b)); // the same order every build, for tidy diffs
  writeFileSync(`${site}/squares/${key}.json`, JSON.stringify(rows));
  counts[key] = rows.length;
}
writeFileSync(
  `${site}/index.json`,
  JSON.stringify({
    attribution: "© OpenStreetMap contributors, ODbL",
    built: new Date().toISOString().slice(0, 10),
    regions,
    squares: counts,
  })
);
console.log(`${byId.size} labels in ${squares.size} squares, written to site/`);
