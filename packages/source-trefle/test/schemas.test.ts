import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TrefleDetailEnvelope,
  TrefleListEnvelope,
  TreflePlantDetail,
  TreflePlantSummary,
} from "../src/schemas.js";
import { hasTrefleToken } from "../src/client.js";
import { getPlant, searchPlants, searchSpecies } from "../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

describe("TreflePlantSummary", () => {
  it("parses a minimal valid record (id + slug + scientific_name)", () => {
    const raw = {
      id: 12345,
      slug: "tomato",
      scientific_name: "Solanum lycopersicum",
    };
    expect(TreflePlantSummary.safeParse(raw).success).toBe(true);
  });

  it("accepts the common nullable fields as null", () => {
    const raw = {
      id: 1,
      slug: "x",
      scientific_name: "X x",
      common_name: null,
      year: null,
      bibliography: null,
      author: null,
      status: null,
      rank: null,
      family_common_name: null,
      genus_id: null,
      image_url: null,
      synonyms: null,
      genus: null,
      family: null,
      links: null,
    };
    expect(TreflePlantSummary.safeParse(raw).success).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    expect(TreflePlantSummary.safeParse({ slug: "x" }).success).toBe(false);
    expect(
      TreflePlantSummary.safeParse({ id: 1, scientific_name: "X x" }).success,
    ).toBe(false);
    expect(
      TreflePlantSummary.safeParse({ id: 1, slug: "x" }).success,
    ).toBe(false);
  });

  it("passes through unknown fields (Trefle is in beta — schema is non-strict)", () => {
    const raw = {
      id: 1,
      slug: "x",
      scientific_name: "X x",
      future_field_added_later: "extra",
    };
    const parsed = TreflePlantSummary.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(
        (parsed.data as Record<string, unknown>).future_field_added_later,
      ).toBe("extra");
    }
  });
});

describe("TreflePlantDetail", () => {
  it("parses a minimal valid record", () => {
    const raw = {
      id: 1,
      slug: "tomato",
      scientific_name: "Solanum lycopersicum",
    };
    expect(TreflePlantDetail.safeParse(raw).success).toBe(true);
  });

  it("accepts main_species: null (live API can return bare null)", () => {
    const raw = {
      id: 1,
      slug: "tomato",
      scientific_name: "Solanum lycopersicum",
      main_species: null,
    };
    expect(TreflePlantDetail.safeParse(raw).success).toBe(true);
  });

  it("parses a detail with embedded main_species + growth + flower", () => {
    const raw = {
      id: 1,
      slug: "tomato",
      scientific_name: "Solanum lycopersicum",
      main_species: {
        id: 42,
        common_name: "Tomato",
        slug: "tomato",
        scientific_name: "Solanum lycopersicum",
        edible: true,
        edible_part: ["fruit"],
        vegetable: true,
        growth: {
          light: 9,
          atmospheric_humidity: 6,
          ph_minimum: 5.5,
          ph_maximum: 7.5,
          minimum_temperature: { deg_c: 10, deg_f: 50 },
          maximum_temperature: { deg_c: 30, deg_f: 86 },
          days_to_harvest: null,
          sowing: null,
          growth_months: null,
        },
        specifications: {
          growth_habit: "Vine",
          growth_rate: "Rapid",
        },
        flower: { color: ["yellow"], conspicuous: true },
      },
    };
    expect(TreflePlantDetail.safeParse(raw).success).toBe(true);
  });

  it("accepts main_species.growth.minimum_temperature: null (bare null, not wrapper object)", () => {
    const raw = {
      id: 1,
      slug: "x",
      scientific_name: "X x",
      main_species: {
        id: 1,
        growth: {
          minimum_temperature: null,
          maximum_temperature: null,
        },
      },
    };
    expect(TreflePlantDetail.safeParse(raw).success).toBe(true);
  });

  it("rejects when slug is missing", () => {
    const raw = { id: 1, scientific_name: "X x" };
    expect(TreflePlantDetail.safeParse(raw).success).toBe(false);
  });
});

describe("TrefleListEnvelope", () => {
  it("parses a typical search response", () => {
    const raw = {
      data: [{ id: 1, slug: "tomato", scientific_name: "Solanum lycopersicum" }],
      meta: { total: 1 },
      links: {
        self: "/api/v1/plants?page=1",
        first: "/api/v1/plants?page=1",
        next: null,
        last: "/api/v1/plants?page=1",
      },
    };
    expect(TrefleListEnvelope.safeParse(raw).success).toBe(true);
  });

  it("accepts an empty data array", () => {
    expect(TrefleListEnvelope.safeParse({ data: [] }).success).toBe(true);
  });

  it("accepts meta and links being null/absent", () => {
    expect(
      TrefleListEnvelope.safeParse({ data: [], meta: null, links: null })
        .success,
    ).toBe(true);
  });

  it("rejects when data is missing", () => {
    expect(TrefleListEnvelope.safeParse({ meta: { total: 0 } }).success).toBe(
      false,
    );
  });
});

describe("TrefleDetailEnvelope", () => {
  it("parses a typical detail response", () => {
    const raw = {
      data: { id: 1, slug: "tomato", scientific_name: "Solanum lycopersicum" },
      meta: { last_modified: "2026-05-08" },
    };
    expect(TrefleDetailEnvelope.safeParse(raw).success).toBe(true);
  });

  it("rejects when data is missing", () => {
    expect(TrefleDetailEnvelope.safeParse({ meta: {} }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasTrefleToken — env-driven helper
// ---------------------------------------------------------------------------

describe("hasTrefleToken", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.TREFLE_API_TOKEN;
    delete process.env.TREFLE_API_TOKEN;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.TREFLE_API_TOKEN;
    } else {
      process.env.TREFLE_API_TOKEN = saved;
    }
  });

  it("returns false when env var is unset", () => {
    expect(hasTrefleToken()).toBe(false);
  });

  it("returns false when env var is the empty string", () => {
    process.env.TREFLE_API_TOKEN = "";
    expect(hasTrefleToken()).toBe(false);
  });

  it("returns false when env var is whitespace only", () => {
    process.env.TREFLE_API_TOKEN = "   ";
    expect(hasTrefleToken()).toBe(false);
  });

  it("returns true when env var has a non-blank value", () => {
    process.env.TREFLE_API_TOKEN = "test-token-xyz";
    expect(hasTrefleToken()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Function input validation — early-return paths, no network involved
// ---------------------------------------------------------------------------

describe("searchPlants input validation", () => {
  it("returns err when no filter param is provided", async () => {
    const result = await searchPlants({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe("trefle");
      expect(result.error.message).toContain("at least one of");
    }
  });

  it("returns err when page is below 1", async () => {
    const result = await searchPlants({ query: "tomato", page: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("page must be");
    }
  });

  it("returns err when page exceeds 50", async () => {
    const result = await searchPlants({ query: "tomato", page: 51 });
    expect(result.ok).toBe(false);
  });

  it("returns err when page is non-integer", async () => {
    const result = await searchPlants({ query: "tomato", page: 1.5 });
    expect(result.ok).toBe(false);
  });
});

describe("searchSpecies input validation", () => {
  it("returns err when no filter param is provided", async () => {
    const result = await searchSpecies({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("at least one of");
    }
  });

  it("returns err when page is out of [1..50]", async () => {
    const result = await searchSpecies({ family: "Brassicaceae", page: 999 });
    expect(result.ok).toBe(false);
  });
});

describe("getPlant input validation", () => {
  it("returns err when slugOrId is the empty string", async () => {
    const result = await getPlant("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("slug or id");
    }
  });

  it("returns err when slugOrId is whitespace only", async () => {
    const result = await getPlant("   ");
    expect(result.ok).toBe(false);
  });
});
