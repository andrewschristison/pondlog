import { describe, expect, it } from "vitest";
import {
  InatObservationSchema,
  InatObserverResultSchema,
  InatPaginatedSchema,
  InatPlaceSchema,
  InatSpeciesCountResultSchema,
  InatTaxonSchema,
} from "../src/schemas.js";
import {
  normalizeObservation,
  normalizeSpeciesCount,
} from "../src/normalize.js";

describe("InatObservationSchema", () => {
  it("parses a typical observation payload", () => {
    const sample = {
      id: 12345,
      species_guess: "Pacific Chorus Frog",
      taxon: {
        id: 65,
        name: "Pseudacris regilla",
        preferred_common_name: "Pacific Chorus Frog",
        iconic_taxon_name: "Amphibia",
        rank: "species",
      },
      observed_on: "2025-04-15",
      location: "48.118,-123.43",
      place_guess: "Port Angeles, WA",
      quality_grade: "research",
      photos: [{ url: "https://example.com/p.jpg" }],
      user: { id: 1, login: "tester", name: "Tester McGee" },
      created_at: "2025-04-15T10:30:00Z",
    };
    const result = InatObservationSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("tolerates missing optional fields", () => {
    const sample = { id: 1 };
    const result = InatObservationSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("rejects payload missing id", () => {
    const result = InatObservationSchema.safeParse({ species_guess: "x" });
    expect(result.success).toBe(false);
  });
});

describe("normalizeObservation", () => {
  it("parses lat/lng string into Coordinates", () => {
    const raw = InatObservationSchema.parse({
      id: 1,
      taxon: {
        id: 2,
        name: "Quercus garryana",
        preferred_common_name: "Oregon White Oak",
        iconic_taxon_name: "Plantae",
      },
      location: "48.118,-123.43",
      place_guess: "Port Angeles",
      user: { id: 9, login: "pa-naturalist" },
      observed_on: "2025-04-01",
      uri: "https://www.inaturalist.org/observations/1",
    });
    const obs = normalizeObservation(raw);
    expect(obs.coordinates).toEqual({ lat: 48.118, lng: -123.43 });
    expect(obs.iconicTaxon).toBe("Plantae");
    expect(obs.observerName).toBe("pa-naturalist");
    expect(obs.url).toBe("https://www.inaturalist.org/observations/1");
  });

  it("falls back to Unknown iconic taxon for unknown groups", () => {
    const raw = InatObservationSchema.parse({
      id: 2,
      taxon: { id: 3, iconic_taxon_name: "SomeNewKingdom" },
    });
    expect(normalizeObservation(raw).iconicTaxon).toBe("Unknown");
  });
});

describe("InatSpeciesCountResultSchema", () => {
  it("normalizes species counts", () => {
    const raw = InatSpeciesCountResultSchema.parse({
      count: 17,
      taxon: {
        id: 9,
        name: "Branta canadensis",
        preferred_common_name: "Canada Goose",
        iconic_taxon_name: "Aves",
      },
    });
    const sc = normalizeSpeciesCount(raw);
    expect(sc.count).toBe(17);
    expect(sc.iconicTaxon).toBe("Aves");
    expect(sc.commonName).toBe("Canada Goose");
  });
});

describe("InatPaginatedSchema", () => {
  it("wraps results array", () => {
    const Schema = InatPaginatedSchema(InatObservationSchema);
    const result = Schema.safeParse({
      total_results: 1,
      page: 1,
      per_page: 10,
      results: [{ id: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("InatTaxonSchema / InatPlaceSchema / InatObserverResultSchema", () => {
  it("parses minimal taxon/place/observer payloads", () => {
    expect(InatTaxonSchema.safeParse({ id: 1 }).success).toBe(true);
    expect(InatPlaceSchema.safeParse({ id: 5, name: "x" }).success).toBe(true);
    expect(
      InatObserverResultSchema.safeParse({
        user_id: 1,
        user: { id: 1, login: "x" },
        observation_count: 0,
        species_count: 0,
      }).success,
    ).toBe(true);
  });
});
