import { describe, expect, it } from "vitest";
import {
  NpnObservationSchema,
  NpnSiteLevelDataSchema,
  NpnSpeciesSchema,
  NpnStationSchema,
} from "../src/schemas.js";
import {
  denull,
  kingdomToIconic,
  normalizeObservation,
  normalizeSpecies,
  normalizeStation,
} from "../src/normalize.js";
import { bboxWkt, haversineKm } from "../src/wkt.js";

describe("NPN Zod schemas", () => {
  it("parses a real getSpecies record", () => {
    const sample = {
      species_id: 120,
      common_name: "'ohi'a lehua",
      genus: "Metrosideros",
      genus_id: 798,
      genus_common_name: "Lehuas (Metrosideros)",
      species: "polymorpha",
      kingdom: "Plantae",
      itis_taxonomic_sn: 27259,
      functional_type: "Evergreen broadleaf",
      class_id: 15,
      class_common_name: "Flowering Plants",
      class_name: "Magnoliopsida",
      order_id: 89,
      order_common_name: "Myrtle and Evening-primrose Families",
      order_name: "Myrtales",
      family_id: 301,
      family_name: "Myrtaceae",
      family_common_name: "Myrtle Family",
      species_type: [
        {
          Species_Type_ID: 9,
          Species_Type: "Evergreen",
          Comment: null,
          User_Display: 1,
          Kingdom: "Plantae",
          Image_Path: "http://example.com/img.png",
        },
      ],
    };
    expect(NpnSpeciesSchema.safeParse(sample).success).toBe(true);
  });

  it("parses a real getAllStations record", () => {
    const sample = {
      latitude: 43.08535,
      longitude: -70.69133,
      station_name: "Home",
      station_id: 2,
      network_id: "",
      file_url: null,
    };
    expect(NpnStationSchema.safeParse(sample).success).toBe(true);
  });

  it("parses a real getObservations record with -9999 sentinels", () => {
    const sample = {
      observation_id: 116307,
      update_datetime: -9999,
      site_id: 1953,
      latitude: 31.803421,
      longitude: -111.027885,
      elevation_in_meters: 931,
      state: "AZ",
      species_id: 210,
      genus: "Carnegiea",
      species: "gigantea",
      common_name: "saguaro",
      kingdom: "Plantae",
      individual_id: 4119,
      phenophase_id: 201,
      phenophase_description: "Open flowers (1 location)",
      observation_date: "2009-07-16",
      day_of_year: 197,
      phenophase_status: 0,
      intensity_category_id: -9999,
      intensity_value: -9999,
      abundance_value: -9999,
    };
    expect(NpnObservationSchema.safeParse(sample).success).toBe(true);
  });

  it("parses site-level data shape with mean_first/last_yes_julian fields", () => {
    const sample = {
      site_id: 655,
      latitude: 47.669998,
      longitude: -122.28653,
      elevation_in_meters: 42,
      state: "WA",
      species_id: 26,
      genus: "Podophyllum",
      species: "peltatum",
      common_name: "mayapple",
      kingdom: "Plantae",
      phenophase_id: 482,
      phenophase_description: "Initial growth (forbs)",
      first_yes_sample_size: 1,
      mean_first_yes_year: 2010,
      mean_first_yes_doy: 36,
      mean_first_yes_julian_date: 2455233,
      se_first_yes_in_days: -9999,
      mean_numdays_since_prior_no: 3,
      se_numdays_since_prior_no: -9999,
      last_yes_sample_size: 1,
      mean_last_yes_year: 2010,
      mean_last_yes_doy: 74,
      mean_last_yes_julian_date: 2455271,
      se_last_yes_in_days: -9999,
      mean_numdays_until_next_no: 12,
      se_numdays_until_next_no: -9999,
    };
    expect(NpnSiteLevelDataSchema.safeParse(sample).success).toBe(true);
  });
});

describe("normalize", () => {
  it("denull converts -9999 / null / empty string to undefined", () => {
    expect(denull(-9999)).toBe(undefined);
    expect(denull(null)).toBe(undefined);
    expect(denull("")).toBe(undefined);
    expect(denull(42)).toBe(42);
    expect(denull("foo")).toBe("foo");
  });

  it("kingdomToIconic maps known kingdoms", () => {
    expect(kingdomToIconic("Plantae")).toBe("Plantae");
    expect(kingdomToIconic("Animalia")).toBe("Animalia");
    expect(kingdomToIconic("Fungi")).toBe("Fungi");
    expect(kingdomToIconic("Bogus")).toBe("Unknown");
    expect(kingdomToIconic(null)).toBe("Unknown");
    expect(kingdomToIconic(undefined)).toBe("Unknown");
  });

  it("normalizeObservation strips -9999 sentinels", () => {
    const raw = NpnObservationSchema.parse({
      observation_id: 1,
      species_id: 210,
      phenophase_status: 1,
      latitude: 48.0,
      longitude: -123.0,
      observation_date: "2025-04-01",
      common_name: "saguaro",
      genus: "Carnegiea",
      species: "gigantea",
      kingdom: "Plantae",
      intensity_category_id: -9999,
      intensity_value: -9999,
      day_of_year: -9999,
    });
    const out = normalizeObservation(raw);
    expect(out.id).toBe("1");
    expect(out.source).toBe("npn");
    expect(out.taxonName).toBe("Carnegiea gigantea");
    expect(out.commonName).toBe("saguaro");
    expect(out.iconicTaxon).toBe("Plantae");
    expect(out.intensityCategoryId).toBe(undefined);
    expect(out.intensityValue).toBe(undefined);
    expect(out.dayOfYear).toBe(undefined);
    expect(out.phenophaseStatus).toBe(1);
  });

  it("normalizeSpecies builds the binomial when present", () => {
    const raw = NpnSpeciesSchema.parse({
      species_id: 3,
      genus: "Acer",
      species: "rubrum",
      common_name: "red maple",
      kingdom: "Plantae",
    });
    const out = normalizeSpecies(raw);
    expect(out.id).toBe("3");
    expect(out.name).toBe("Acer rubrum");
    expect(out.commonName).toBe("red maple");
    expect(out.iconicTaxon).toBe("Plantae");
    expect(out.rank).toBe("species");
  });

  it("normalizeStation passes through coords and id", () => {
    const raw = NpnStationSchema.parse({
      station_id: 211,
      station_name: "PPN_451484",
      latitude: 48.906799,
      longitude: -122.295502,
      network_id: "",
      file_url: null,
    });
    const out = normalizeStation(raw);
    expect(out.id).toBe("211");
    expect(out.name).toBe("PPN_451484");
    expect(out.coordinates.lat).toBeCloseTo(48.9068, 4);
    expect(out.networkId).toBe(undefined);
  });
});

describe("WKT", () => {
  it("bboxWkt builds a closed polygon", () => {
    const wkt = bboxWkt({ lat: 48.118, lng: -123.4307 }, 25);
    expect(wkt.startsWith("POLYGON((")).toBe(true);
    expect(wkt.endsWith("))")).toBe(true);
    const ring = wkt.slice("POLYGON((".length, -2).split(", ");
    expect(ring.length).toBe(5);
    expect(ring[0]).toBe(ring[4]);
  });

  it("bboxWkt rejects non-positive radii", () => {
    expect(() => bboxWkt({ lat: 0, lng: 0 }, 0)).toThrow();
    expect(() => bboxWkt({ lat: 0, lng: 0 }, -5)).toThrow();
  });

  it("haversineKm: ~0 for identical points; reasonable for known cities", () => {
    const seattle = { lat: 47.6062, lng: -122.3321 };
    const portangeles = { lat: 48.118, lng: -123.4307 };
    expect(haversineKm(seattle, seattle)).toBeCloseTo(0, 5);
    // ~95 km is the published driving / great-circle distance ballpark
    const d = haversineKm(seattle, portangeles);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(110);
  });
});
