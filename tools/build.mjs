// Both steps at once, for building on your own computer: the rows for each
// region (rows.mjs), then the site from them (site.mjs).
// Usage: npm run build [-- europe/denmark europe/norway …] (default: regions.json, the whole world)
//        --fresh   download the extracts again, even if they're in the cache
//        --tidy    delete each extract once its rows are written (to save disk)

import { buildRows } from "./rows.mjs";
import { buildSite } from "./site.mjs";
import { parseArgs } from "./regions.mjs";

const { regions, flags } = parseArgs();
await buildRows(regions, { fresh: flags.has("--fresh"), tidy: flags.has("--tidy") });
await buildSite(regions);
