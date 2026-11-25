import { describe, expect, test } from "vitest";

import { centre, classify, squareKey, toRow } from "../src/labels.js";

describe("classify", () => {
  test("keeps named peaks, with their height", () => {
    expect(classify("n", { natural: "peak", name: "Galdhøpiggen", ele: "2469" })).toEqual({
      kind: "peak",
      name: "Galdhøpiggen",
      number: 2469,
    });
    expect(classify("n", { natural: "peak", ele: "812" })).toBeNull();
  });

  test("keeps named places, with their population", () => {
    expect(classify("n", { place: "town", name: "Lom", population: "2300" })).toMatchObject({ number: 2300 });
    expect(classify("n", { place: "village", name: "Bøverdalen" })).toMatchObject({ number: null });
    expect(classify("n", { place: "hamlet", name: "Røisheim" })).toBeNull();
  });

  test("takes peaks and places as points only, like the Overpass query did", () => {
    expect(classify("w", { natural: "peak", name: "Ridge" })).toBeNull();
    expect(classify("r", { place: "city", name: "Oslo" })).toBeNull();
  });

  test("keeps every lighthouse and observatory, named or not", () => {
    expect(classify("w", { man_made: "lighthouse" })).toEqual({ kind: "lighthouse", name: "", number: null });
    expect(classify("n", { man_made: "observatory", name: "Solobservatoriet" })).toMatchObject({
      name: "Solobservatoriet",
    });
  });

  test("keeps towers and masts with a height that are named or tall, but not bell towers", () => {
    expect(classify("n", { man_made: "mast", height: "120" })).toMatchObject({ kind: "mast", number: 120 });
    expect(classify("n", { man_made: "tower", name: "Tryvannstårnet", height: "118 m" })).toMatchObject({
      number: 118,
    });
    expect(classify("n", { man_made: "mast", height: "25" })).toBeNull();
    expect(classify("n", { man_made: "tower", name: "Named" })).toBeNull();
    expect(classify("w", { man_made: "tower", "tower:type": "bell_tower", name: "Kirke", height: "50" })).toBeNull();
  });
});

describe("squareKey", () => {
  test("names a square by its south-west corner", () => {
    expect(squareKey(59.91, 10.75)).toBe("59_10");
    expect(squareKey(-33.45, -70.66)).toBe("-34_-71");
    expect(squareKey(0, 0)).toBe("0_0");
  });
});

describe("centre", () => {
  test("is a point's own position", () => {
    expect(centre({ type: "Point", coordinates: [8.31, 61.64] })).toEqual({ lat: 61.64, lon: 8.31 });
  });

  test("is the middle of a shape's bounding box", () => {
    const square = {
      type: "Polygon",
      coordinates: [
        [
          [10, 60],
          [12, 60],
          [12, 62],
          [10, 62],
          [10, 60],
        ],
      ],
    };
    expect(centre(square)).toEqual({ lat: 61, lon: 11 });
  });
});

describe("toRow", () => {
  test("is the id, kind, position, name and number", () => {
    const feature = {
      geometry: { type: "Point", coordinates: [8.3124567, 61.6364321] },
      properties: { "@type": "node", "@id": 123, natural: "peak", name: "Galdhøpiggen", ele: "2469.4" },
    };
    expect(toRow(feature)).toEqual(["n123", "peak", 61.63643, 8.31246, "Galdhøpiggen", 2469.4]);
  });

  test("leaves off a number that isn't known", () => {
    const feature = {
      geometry: { type: "Point", coordinates: [5, 58] },
      properties: { "@type": "way", "@id": 7, man_made: "lighthouse" },
    };
    expect(toRow(feature)).toEqual(["w7", "lighthouse", 58, 5, ""]);
  });
});
