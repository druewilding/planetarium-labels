# Planetarium labels

Names for the land around you in the [planetarium](https://www.druewilding.com/planetarium/): mountain peaks, cities,
towns and villages, lighthouses, observatories, and tall or named towers and masts. They come from OpenStreetMap,
filtered from [Geofabrik's extracts](https://download.geofabrik.de/) and split into small files, one for each 1° square
of latitude and longitude.

The planetarium used to ask the public Overpass servers for these, whenever you went somewhere new. Those servers are
often too busy to answer, and ask automated users to use the extracts instead. These files are plain static files on
GitHub Pages: quick, always there, and easy for the planetarium to keep for offline.

## The files

- **`index.json`**: when the files were built, from which regions, and how many labels each square holds. A square
  that isn't listed has no labels.
- **`squares/59_10.json`**: the labels in one square, named by its south-west corner (here 59–60° N, 10–11° E). Squares
  south or west of 0° have negative names, like `-34_-71.json`.

Each label is a row: `[id, kind, lat, lon, name, number]`.

| Field    | What it is                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`     | The OpenStreetMap thing: `n123` for node 123, `w` for a way, `r` for a relation                                            |
| `kind`   | `peak`, `volcano`, `city`, `town`, `village`, `lighthouse`, `observatory`, `tower` or `mast`                               |
| `lat`    | Degrees north, to 5 places (about a metre). The middle of the outline, for buildings drawn as one                          |
| `lon`    | Degrees east, to 5 places                                                                                                  |
| `name`   | Its name, or `""` (only lighthouses, observatories, towers and masts can be nameless)                                      |
| `number` | Height above the sea for a peak or volcano, population for a place, how tall it is for a landmark; left off when not known |

## What gets a label

- **Peaks and volcanoes** with a name.
- **Cities, towns and villages** with a name. Hamlets and smaller places are left out.
- **Lighthouses and observatories**, named or not.
- **Towers and masts** with a height that are named or at least 40 m tall. Bell towers are left out: church towers are
  everywhere.

## Building

`regions.json` lists Geofabrik's nine top-level regions, which together cover the whole world (about 90 GB of
extracts). The build has two steps:

1. **Rows:** for each region, download its extract, keep what's worth a label, and write it to
   `rows/<region>.ndjson`, one row per line.
2. **Site:** merge every region's rows (keeping one of each thing where regions overlap at their borders) into the
   squares and `index.json`, in `site/`. It stops if any region's rows are missing, so the site is only ever whole.

Needs Node, curl and [osmium](https://osmcode.org/osmium-tool/) (`brew install osmium-tool`). To try it on your own
computer, name a few small regions instead of building the world:

```sh
npm install
npm run build -- europe/denmark europe/norway   # both steps, for just these regions
npm run build -- europe/denmark --tidy          # delete each extract once it's done, to save disk
npm run build -- europe/denmark --fresh         # download the extracts again
npm run rows -- europe/denmark                  # just step 1
npm run site -- europe/denmark                  # just step 2
```

Extracts are downloaded to `cache/` (or `CACHE_DIR`). Region names are Geofabrik's paths, as in
`https://download.geofabrik.de/europe/norway.html`.

### On GitHub

The **Build and publish** workflow:

1. Checks the code (lint and tests).
2. Builds each region's rows in its own job, side by side. Europe's extract is over 35 GB, so the jobs download to the
   runner's second disk, or clear space on the main one.
3. Merges them into the site and publishes it on GitHub Pages, at <https://www.druewilding.com/planetarium-labels/>.
   If any region fails, nothing is published and the last build stays up.

It runs when the regions or the code change on `main`, on the first of every third month, and by hand from the Actions
tab.

## Licence

The code is ISC. The labels are © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under
the Open Database Licence: anything showing them must say so.
