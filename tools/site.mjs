// Step 2: merge the regions' rows (from rows.mjs) into one file per 1° square,
// and index.json, in site/. Every region must have its rows: the site is only
// ever published whole.
// Usage: npm run site [-- europe/norway …] (default: regions.json)

import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { squaresOf } from "../src/labels.js";
import { parseArgs, rowsDir, siteDir, slug } from "./regions.mjs";

async function* rowsOf(region) {
  const file = `${rowsDir}/${slug(region)}.ndjson`;
  if (!existsSync(file)) throw new Error(`No rows for ${region}: run npm run rows -- ${region}`);
  for await (const line of createInterface({ input: createReadStream(file) })) if (line) yield JSON.parse(line);
}

/** Write site/ from the rows of every region. */
export async function buildSite(regions) {
  const rows = [];
  for (const region of regions) for await (const row of rowsOf(region)) rows.push(row);
  const squares = squaresOf(rows);

  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(`${siteDir}/squares`, { recursive: true });
  const counts = {};
  let total = 0;
  for (const [key, list] of squares) {
    writeFileSync(`${siteDir}/squares/${key}.json`, JSON.stringify(list));
    counts[key] = list.length;
    total += list.length;
  }
  writeFileSync(
    `${siteDir}/index.json`,
    JSON.stringify({
      attribution: "© OpenStreetMap contributors, ODbL",
      built: new Date().toISOString().slice(0, 10),
      regions,
      squares: counts,
    })
  );
  console.log(`${total} labels in ${squares.length} squares, written to site/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildSite(parseArgs().regions);
}
