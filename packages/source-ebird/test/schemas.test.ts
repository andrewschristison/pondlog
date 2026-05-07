import { describe, expect, it } from "vitest";
import {
  EbirdChecklistSummarySchema,
  EbirdHotspotInfoSchema,
  EbirdHotspotSchema,
  EbirdObservationSchema,
  EbirdRegionInfoSchema,
  EbirdSubRegionSchema,
  EbirdTaxonomyEntrySchema,
  EbirdTaxonomyVersionSchema,
  EbirdTop100EntrySchema,
} from "../src/schemas.js";
import {
  normalizeHotspot,
  normalizeObservation,
  normalizeTaxonomyEntry,
} from "../src/normalize.js";

describe("EbirdObservationSchema", () => {
  it("parses a minimal valid observation", () => {
    const raw = {
      speciesCode: "amecro",
      comName: "American Crow",
      sciName: "Corvus brachyrhynchos",
      locId: "L99999",
      locName: "Some Park",
      obsDt: "2026-05-07 09:30",
      howMany: 4,
      lat: 48.118,
      lng: -123.4307,
    };
    const parsed = EbirdObservationSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("accepts howMany null (heard but not counted)", () => {
    const raw = {
      speciesCode: "amecro",
      comName: "American Crow",
      sciName: "Corvus brachyrhynchos",
      locId: "L99999",
      locName: "Some Park",
      obsDt: "2026-05-07 09:30",
      howMany: null,
      lat: 48.118,
      lng: -123.4307,
    };
    expect(EbirdObservationSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects when required fields missing", () => {
    const bad = { speciesCode: "amecro" };
    expect(EbirdObservationSchema.safeParse(bad).success).toBe(false);
  });
});

describe("EbirdHotspotSchema", () => {
  it("parses a hotspot with optional latestObsDt null", () => {
    const raw = {
      locId: "L123",
      locName: "Ediz Hook",
      countryCode: "US",
      subnational1Code: "US-WA",
      subnational2Code: "US-WA-009",
      lat: 48.139,
      lng: -123.418,
      latestObsDt: null,
      numSpeciesAllTime: null,
    };
    expect(EbirdHotspotSchema.safeParse(raw).success).toBe(true);
  });
});

describe("EbirdHotspotInfoSchema", () => {
  it("parses hotspot info with hierarchicalName", () => {
    const raw = {
      locId: "L123",
      name: "Ediz Hook",
      latitude: 48.139,
      longitude: -123.418,
      countryCode: "US",
      countryName: "United States",
      subnational1Name: "Washington",
      subnational1Code: "US-WA",
      subnational2Code: "US-WA-009",
      isHotspot: true,
      hierarchicalName: "Ediz Hook, Clallam County, Washington, US",
    };
    expect(EbirdHotspotInfoSchema.safeParse(raw).success).toBe(true);
  });
});

describe("EbirdTaxonomyEntrySchema", () => {
  it("parses a minimum taxonomy entry", () => {
    const raw = {
      sciName: "Corvus brachyrhynchos",
      comName: "American Crow",
      speciesCode: "amecro",
      category: "species",
      taxonOrder: 21800.0,
    };
    expect(EbirdTaxonomyEntrySchema.safeParse(raw).success).toBe(true);
  });
});

describe("EbirdTaxonomyVersionSchema", () => {
  it("parses an authority version", () => {
    expect(EbirdTaxonomyVersionSchema.safeParse({ authorityVer: 2024, latest: true }).success).toBe(true);
  });
});

describe("EbirdSubRegionSchema", () => {
  it("parses a subregion", () => {
    expect(EbirdSubRegionSchema.safeParse({ code: "US-WA", name: "Washington" }).success).toBe(true);
  });
});

describe("EbirdRegionInfoSchema", () => {
  it("parses region info with bounds", () => {
    const raw = {
      bounds: { minX: -124.7, maxX: -116.9, minY: 45.5, maxY: 49.0 },
      result: "Washington, United States (US)",
    };
    expect(EbirdRegionInfoSchema.safeParse(raw).success).toBe(true);
  });
});

describe("EbirdChecklistSummarySchema", () => {
  it("parses a checklist summary", () => {
    const raw = {
      locId: "L123",
      subId: "S987654321",
      userDisplayName: "Jane Birder",
      numSpecies: 22,
      obsDt: "7 May 2026",
      obsTime: "09:30",
    };
    expect(EbirdChecklistSummarySchema.safeParse(raw).success).toBe(true);
  });
});

describe("EbirdTop100EntrySchema", () => {
  it("parses a top100 entry", () => {
    expect(
      EbirdTop100EntrySchema.safeParse({
        userDisplayName: "Jane Birder",
        numSpecies: 184,
        numCompleteChecklists: 12,
      }).success,
    ).toBe(true);
  });
});

// Normalization

describe("normalizeObservation", () => {
  it("maps eBird raw to shared Observation with iconicTaxon=Aves", () => {
    const raw = {
      speciesCode: "amecro",
      comName: "American Crow",
      sciName: "Corvus brachyrhynchos",
      locId: "L99999",
      locName: "Some Park",
      obsDt: "2026-05-07 09:30",
      howMany: 4,
      lat: 48.118,
      lng: -123.4307,
      subId: "S987654321",
      userDisplayName: "Jane Birder",
      obsValid: true,
    };
    const o = normalizeObservation(raw);
    expect(o.source).toBe("ebird");
    expect(o.iconicTaxon).toBe("Aves");
    expect(o.taxonName).toBe("Corvus brachyrhynchos");
    expect(o.commonName).toBe("American Crow");
    expect(o.coordinates).toEqual({ lat: 48.118, lng: -123.4307 });
    expect(o.observerName).toBe("Jane Birder");
    expect(o.url).toBe("https://ebird.org/checklist/S987654321");
    expect(o.qualityGrade).toBe("valid");
    expect(o.id).toBe("S987654321:amecro");
  });

  it("falls back to locId composite id when subId missing", () => {
    const raw = {
      speciesCode: "amecro",
      comName: "American Crow",
      sciName: "Corvus brachyrhynchos",
      locId: "L1",
      locName: "Park",
      obsDt: "2026-05-07 09:30",
      howMany: 1,
      lat: 0,
      lng: 0,
    };
    const o = normalizeObservation(raw);
    expect(o.id).toBe("L1:amecro:2026-05-07 09:30");
    expect(o.observerName).toBe("unknown");
    expect(o.url).toBe("https://ebird.org");
  });
});

describe("normalizeHotspot", () => {
  it("maps eBird hotspot to shared Place", () => {
    const raw = {
      locId: "L123",
      locName: "Ediz Hook",
      lat: 48.139,
      lng: -123.418,
      latestObsDt: "2026-05-06 15:00",
      numSpeciesAllTime: 245,
    };
    const p = normalizeHotspot(raw);
    expect(p.source).toBe("ebird");
    expect(p.id).toBe("L123");
    expect(p.coordinates).toEqual({ lat: 48.139, lng: -123.418 });
  });
});

describe("normalizeTaxonomyEntry", () => {
  it("maps eBird taxonomy entry to shared Taxon", () => {
    const t = normalizeTaxonomyEntry({
      sciName: "Corvus brachyrhynchos",
      comName: "American Crow",
      speciesCode: "amecro",
      category: "species",
      taxonOrder: 21800,
    });
    expect(t.source).toBe("ebird");
    expect(t.id).toBe("amecro");
    expect(t.iconicTaxon).toBe("Aves");
    expect(t.rank).toBe("species");
  });
});
