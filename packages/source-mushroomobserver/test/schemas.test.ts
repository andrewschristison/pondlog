import { describe, expect, it } from "vitest";
import {
  bboxAround,
  MoNameEnvelope,
  MoObservationEnvelope,
} from "../src/index.js";
import { normalizeName, normalizeObservation, stripHtml } from "../src/normalize.js";

describe("MO bboxAround", () => {
  it("produces a sensible square around Port Angeles", () => {
    const box = bboxAround({ lat: 48.118, lng: -123.4307 }, 25);
    expect(box.north - box.south).toBeGreaterThan(0.4);
    expect(box.north - box.south).toBeLessThan(0.5);
    expect(box.east).toBeGreaterThan(box.west);
    expect(box.north).toBeGreaterThan(box.south);
  });

  it("rejects non-positive radii", () => {
    expect(() => bboxAround({ lat: 0, lng: 0 }, 0)).toThrow();
    expect(() => bboxAround({ lat: 0, lng: 0 }, -1)).toThrow();
  });
});

describe("MO observation schema (low detail)", () => {
  const sample = {
    version: 2.0,
    run_date: "2026-05-08T01:44:40.570Z",
    number_of_records: 288,
    number_of_pages: 1,
    page_number: 1,
    results: [
      {
        id: 187521,
        type: "observation",
        date: "2014-11-06",
        gps_hidden: false,
        specimen_available: false,
        is_collection_location: true,
        confidence: 2.25982,
        notes:
          "Growing on dune, amongst dune grasses. <p>11&#8217;&#8217; across</p>",
        owner_id: 6712,
        consensus_id: 5508,
        consensus_name: "Agaricus moelleri",
        location_id: 10807,
        location_name:
          "Ediz Hook, Port Angeles, Clallam Co., Washington, USA",
        primary_image_id: 479099,
      },
    ],
  };

  it("parses an MO low-detail envelope", () => {
    const parsed = MoObservationEnvelope.parse(sample);
    expect(parsed.results).toHaveLength(1);
    const first = parsed.results?.[0];
    expect(first?.id).toBe(187521);
    expect(first?.consensus_name).toBe("Agaricus moelleri");
  });

  it("normalizes a low-detail observation into a stable shape", () => {
    const parsed = MoObservationEnvelope.parse(sample);
    const first = parsed.results?.[0];
    if (!first) throw new Error("no fixture results");
    const n = normalizeObservation(first);
    expect(n.id).toBe(187521);
    expect(n.consensusName).toBe("Agaricus moelleri");
    expect(n.locationName).toContain("Port Angeles");
    expect(n.gpsHidden).toBe(false);
    expect(n.confidence).toBeCloseTo(2.25982, 5);
    expect(n.primaryImageUrl).toBe(
      "https://mushroomobserver.org/images/orig/479099.jpg",
    );
    expect(n.url).toBe("https://mushroomobserver.org/187521");
    expect(n.notes).toContain("dune grasses");
    expect(n.notes).not.toContain("<p>");
    expect(n.notes).toContain("’"); // entity decoded
  });
});

describe("MO observation schema (high detail with nested location)", () => {
  const sample = {
    results: [
      {
        id: 187521,
        type: "observation",
        date: "2014-11-06",
        gps_hidden: false,
        confidence: 2.25,
        owner: { id: 6712, login_name: "KAButcher", legal_name: "KA Butcher" },
        consensus: {
          id: 5508,
          name: "Agaricus moelleri",
          author: "Wasser",
          rank: "species",
          synonym_id: 18,
        },
        namings: [
          {
            id: 249141,
            name: {
              id: 5508,
              name: "Agaricus moelleri",
              author: "Wasser",
              rank: "species",
              synonym_id: 18,
            },
            confidence: 2.35582,
            owner: { id: 6712, login_name: "KAButcher" },
          },
        ],
        location: {
          id: 10807,
          name: "Ediz Hook, Port Angeles, Clallam Co., Washington, USA",
          latitude_north: "48.14220047",
          latitude_south: "48.1375999451",
          longitude_east: "-123.4000015259",
          longitude_west: "-123.4599990845",
        },
        primary_image: {
          id: 479099,
          original_url: "https://mushroomobserver.org/images/orig/479099.jpg",
          owner: { id: 6712, login_name: "KAButcher" },
        },
      },
    ],
  };

  it("normalizes high-detail nested fields and falls back to location centroid when coords are missing", () => {
    const parsed = MoObservationEnvelope.parse(sample);
    const first = parsed.results?.[0];
    if (!first) throw new Error("no fixture results");
    const n = normalizeObservation(first);
    expect(n.coordinates?.lat).toBeCloseTo(48.139, 2);
    expect(n.coordinates?.lng).toBeCloseTo(-123.43, 2);
    expect(n.observerLogin).toBe("KAButcher");
    expect(n.consensusId).toBe(5508);
  });
});

describe("MO names schema", () => {
  const sample = {
    results: [
      {
        id: 329,
        type: "name",
        name: "Cantharellus formosus",
        author: "Corner",
        rank: "species",
        deprecated: false,
        misspelled: false,
        citation: "<cite>Monogr. Cantharelloid Fungi</cite>: 45 (1966)",
        parents: [
          { name: "Eukarya", rank: "domain" },
          { name: "Fungi", rank: "kingdom" },
          { name: "Basidiomycota", rank: "phylum" },
        ],
        synonym_id: 591,
      },
    ],
  };

  it("normalizes a name into a flat shape", () => {
    const parsed = MoNameEnvelope.parse(sample);
    const first = parsed.results?.[0];
    if (!first) throw new Error("no fixture results");
    const n = normalizeName(first);
    expect(n.id).toBe(329);
    expect(n.scientificName).toBe("Cantharellus formosus");
    expect(n.classification).toEqual(["Eukarya", "Fungi", "Basidiomycota"]);
    expect(n.citation).not.toContain("<cite>");
    expect(n.url).toBe("https://mushroomobserver.org/name/show_name/329");
  });
});

describe("stripHtml", () => {
  it("decodes common entities and removes tags", () => {
    expect(stripHtml("<p>Hello&nbsp;world&#8217;s test</p>")).toBe(
      "Hello world’s test",
    );
  });

  it("returns empty string for null/undefined", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });
});
