// Which things from OpenStreetMap get a label in the planetarium, and how they're
// stored: one row each, in a file per 1° square of latitude and longitude.
//
// A row is [id, kind, lat, lon, name, number]:
//   id      "n123" for node 123, "w" for a way, "r" for a relation
//   kind    peak, volcano, city, town, village, lighthouse, observatory, tower, mast
//   name    "" when it has none (only lighthouses, observatories, towers and masts)
//   number  height above the sea for a peak or volcano, population for a place,
//           and how tall it stands for a landmark; left off when not known

/** The kinds the planetarium shows, by the OpenStreetMap tag that marks them. */
const KINDS = {
  natural: ["peak", "volcano"],
  place: ["city", "town", "village"],
  man_made: ["lighthouse", "observatory", "tower", "mast"],
};

/** The tag filter for osmium, to keep only what could be a label. */
export const OSMIUM_FILTER = [
  "n/natural=peak,volcano",
  "n/place=city,town,village",
  "nwr/man_made=lighthouse,observatory,tower,mast",
];

const number = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * What a thing is, and its number, or null if the planetarium wouldn't label it.
 * The same choices the planetarium made of the Overpass results.
 */
export function classify(type, tags) {
  const name = tags.name ?? "";
  if (KINDS.natural.includes(tags.natural)) {
    return type === "n" && name ? { kind: tags.natural, name, number: number(tags.ele) } : null;
  }
  if (KINDS.place.includes(tags.place)) {
    return type === "n" && name ? { kind: tags.place, name, number: parseInt(tags.population, 10) || null } : null;
  }
  const kind = tags.man_made;
  const height = number(tags.height);
  if (kind === "lighthouse" || kind === "observatory") return { kind, name, number: height };
  if (kind === "tower" || kind === "mast") {
    // Plenty of small phone masts and church towers: keep the named and the tall.
    if (height == null || tags["tower:type"] === "bell_tower") return null;
    if (!name && height < 40) return null;
    return { kind, name, number: height };
  }
  return null;
}

/** The square a place is in, named by its south-west corner: "59_10", "-34_-71". */
export const squareKey = (lat, lon) => `${Math.floor(lat)}_${Math.floor(lon)}`;

/** The middle of a GeoJSON geometry's bounding box, as Overpass gives for "out center". */
export function centre(geometry) {
  let [s, w, n, e] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === "number") {
      [s, n] = [Math.min(s, c[1]), Math.max(n, c[1])];
      [w, e] = [Math.min(w, c[0]), Math.max(e, c[0])];
    } else c.forEach(walk);
  };
  walk(geometry.coordinates);
  return { lat: (s + n) / 2, lon: (w + e) / 2 };
}

/**
 * Rows grouped into squares, as [key, rows] sorted by key, each square's rows
 * sorted by id: the same order every build, for tidy diffs. Keeps one of each id,
 * since neighbouring extracts overlap at their borders.
 */
export function squaresOf(rows) {
  const byId = new Map();
  for (const row of rows) byId.set(row[0], row);
  const squares = new Map();
  for (const row of byId.values()) {
    const key = squareKey(row[2], row[3]);
    if (!squares.has(key)) squares.set(key, []);
    squares.get(key).push(row);
  }
  const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  for (const list of squares.values()) list.sort((a, b) => byKey(a[0], b[0]));
  return [...squares].sort(([a], [b]) => byKey(a, b));
}

const round = (x, places) => Math.round(x * 10 ** places) / 10 ** places;

/** The row for one GeoJSON feature from `osmium export --attributes type,id`, or null. */
export function toRow(feature) {
  const { "@type": osmType, "@id": osmId, ...tags } = feature.properties;
  const type = osmType[0];
  const label = classify(type, tags);
  if (!label) return null;
  const { lat, lon } = centre(feature.geometry);
  const row = [`${type}${osmId}`, label.kind, round(lat, 5), round(lon, 5), label.name];
  if (label.number != null) row.push(round(label.number, 1));
  return row;
}
