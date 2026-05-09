// Trefle.io client surface.
//
// SCOPE NOTE — Trefle is the *taxonomy* layer of pondlog's garden surface.
// We live-probed the live API in May 2026 and found that horticulture fields
// (days_to_harvest, sowing instructions, growth_months, hardiness) are
// universally null for cultivated vegetables. The 500-crop planting calendar
// in @pondlog/core covers planning logic. Trefle covers:
//
//   - common name → scientific name resolution
//   - genus / family / synonym lookup
//   - light, soil pH, atmospheric humidity, image URLs (when populated)
//
// All functions return Result<T>, never throw. See client.ts for rate-limit
// and retry behavior.

import { err, ok, type Result } from "@pondlog/core";
import { hasTrefleToken, trefleFetch } from "./client.js";
import {
  TrefleDetailEnvelope,
  TrefleListEnvelope,
  type TreflePlantDetail,
  type TreflePlantSummary,
} from "./schemas.js";

export {
  TreflePlantSummary,
  TreflePlantDetail,
  TrefleListEnvelope,
  TrefleDetailEnvelope,
} from "./schemas.js";
export { hasTrefleToken } from "./client.js";

const PAGE_DEFAULT = 1;
const PAGE_MAX = 50;

// ---------------------------------------------------------------------------
// 1. searchPlants — substring/prefix search by common name.
//
// Trefle's `q=` is a full-text query that matches author/bibliography fields
// noisily. `filter[common_name]=tomato` is far more precise. We expose both
// — `query` is the high-recall path, `commonNameExact` is the disambiguator.
// ---------------------------------------------------------------------------

export interface SearchPlantsParams {
  /** Free-text query (matches noisily across multiple fields). */
  query?: string;
  /** Exact common-name filter — best for "find me the plant called X". */
  commonNameExact?: string;
  /** Family name filter (e.g. "Brassicaceae"). */
  family?: string;
  /** Genus name filter. */
  genus?: string;
  /** 1-indexed page number (Trefle pages are 20 records each). Default 1. */
  page?: number;
}

export interface SearchPlantsResult {
  plants: TreflePlantSummary[];
  total: number;
  page: number;
  hasMore: boolean;
}

export async function searchPlants(
  params: SearchPlantsParams,
): Promise<Result<SearchPlantsResult>> {
  if (
    !params.query &&
    !params.commonNameExact &&
    !params.family &&
    !params.genus
  ) {
    return err({
      source: "trefle",
      message:
        "searchPlants: at least one of {query, commonNameExact, family, genus} is required (Trefle has 1M+ plants and unbounded queries are wasteful)",
    });
  }
  const page = params.page ?? PAGE_DEFAULT;
  if (!Number.isInteger(page) || page < 1 || page > PAGE_MAX) {
    return err({
      source: "trefle",
      message: `searchPlants: page must be in [1..${PAGE_MAX}], got ${page}`,
    });
  }

  const search: Record<string, string | number | boolean | undefined> = {
    page,
  };
  if (params.query) search.q = params.query;
  if (params.commonNameExact) {
    search["filter[common_name]"] = params.commonNameExact;
  }
  if (params.family) search["filter[family_name]"] = params.family;
  if (params.genus) search["filter[genus]"] = params.genus;

  const result = await trefleFetch("/plants", TrefleListEnvelope, {
    searchParams: search,
  });
  if (!result.ok) return result;
  const total = result.data.meta?.total ?? result.data.data.length;
  const hasMore = !!result.data.links?.next;
  return ok({
    plants: result.data.data,
    total,
    page,
    hasMore,
  });
}

// ---------------------------------------------------------------------------
// 2. getPlant — full detail for a single plant by slug or numeric id.
//
// Returns the rich /plants/{id} response. Many growth fields will be null
// for cultivated vegetables (Trefle's horticulture coverage is sparse).
// Use the @pondlog/core crop calendar for planting schedules.
// ---------------------------------------------------------------------------

export async function getPlant(
  slugOrId: string | number,
): Promise<Result<TreflePlantDetail>> {
  const ident = String(slugOrId).trim();
  if (ident.length === 0) {
    return err({
      source: "trefle",
      message: "getPlant: slug or id is required",
    });
  }
  const result = await trefleFetch(
    `/plants/${encodeURIComponent(ident)}`,
    TrefleDetailEnvelope,
  );
  if (!result.ok) return result;
  return ok(result.data.data);
}

// ---------------------------------------------------------------------------
// 3. searchSpecies — like searchPlants but against /species endpoint.
//
// Trefle distinguishes "plant" (the taxonomic primary species) from "species"
// (one of many subspecies/varieties under a plant). For most home-garden use
// cases the /plants endpoint is correct — /species is the deeper drilldown
// when a user wants a specific cultivar group.
// ---------------------------------------------------------------------------

export async function searchSpecies(
  params: SearchPlantsParams,
): Promise<Result<SearchPlantsResult>> {
  if (
    !params.query &&
    !params.commonNameExact &&
    !params.family &&
    !params.genus
  ) {
    return err({
      source: "trefle",
      message:
        "searchSpecies: at least one of {query, commonNameExact, family, genus} is required",
    });
  }
  const page = params.page ?? PAGE_DEFAULT;
  if (!Number.isInteger(page) || page < 1 || page > PAGE_MAX) {
    return err({
      source: "trefle",
      message: `searchSpecies: page must be in [1..${PAGE_MAX}], got ${page}`,
    });
  }
  const search: Record<string, string | number | boolean | undefined> = {
    page,
  };
  if (params.query) search.q = params.query;
  if (params.commonNameExact) {
    search["filter[common_name]"] = params.commonNameExact;
  }
  if (params.family) search["filter[family_name]"] = params.family;
  if (params.genus) search["filter[genus]"] = params.genus;

  const result = await trefleFetch("/species", TrefleListEnvelope, {
    searchParams: search,
  });
  if (!result.ok) return result;
  const total = result.data.meta?.total ?? result.data.data.length;
  const hasMore = !!result.data.links?.next;
  return ok({
    plants: result.data.data,
    total,
    page,
    hasMore,
  });
}

// ---------------------------------------------------------------------------
// 4. getGrowingGuide — convenience that pulls a plant's main_species and
//    returns a flat, gardener-friendly summary of the available growth fields.
//    Many fields will be undefined; the caller can render "(unknown)" for
//    those.
// ---------------------------------------------------------------------------

export interface GrowingGuide {
  id: number;
  slug: string;
  commonName?: string;
  scientificName: string;
  family?: string;
  genus?: string;
  edible?: boolean;
  edibleParts?: string[];
  vegetable?: boolean;
  duration?: string[];
  /** Sun requirement on Trefle's 0-10 scale (10 = full sun). */
  light?: number;
  /** Atmospheric humidity preference 0-10. */
  atmosphericHumidity?: number;
  phMin?: number;
  phMax?: number;
  /** Trefle's stated growth-season minimum air temp (NOT USDA hardiness — see
   *  @pondlog/core/usda-zones for hardiness mapping). */
  minimumGrowthTempF?: number;
  minimumGrowthTempC?: number;
  maximumGrowthTempF?: number;
  maximumGrowthTempC?: number;
  daysToHarvest?: number;
  sowingNotes?: string;
  growthMonths?: string[];
  bloomMonths?: string[];
  fruitMonths?: string[];
  growthHabit?: string;
  growthRate?: string;
  flowerColors?: string[];
  imageUrl?: string;
  trefleSourceUrl: string;
}

export async function getGrowingGuide(
  slugOrId: string | number,
): Promise<Result<GrowingGuide>> {
  const detail = await getPlant(slugOrId);
  if (!detail.ok) return detail;
  const plant = detail.data;
  const ms = plant.main_species ?? null;
  const growth = ms?.growth ?? null;
  const specs = ms?.specifications ?? null;
  const flower = ms?.flower ?? null;

  const out: GrowingGuide = {
    id: plant.id,
    slug: plant.slug,
    scientificName: plant.scientific_name,
    trefleSourceUrl: `https://trefle.io/api/v1/plants/${plant.slug}`,
  };
  if (plant.common_name) out.commonName = plant.common_name;
  if (plant.family?.name) out.family = plant.family.name;
  if (plant.genus?.name) out.genus = plant.genus.name;
  if (ms?.edible !== undefined && ms.edible !== null) out.edible = ms.edible;
  if (ms?.edible_part) out.edibleParts = ms.edible_part;
  if (ms?.vegetable !== undefined && ms.vegetable !== null) {
    out.vegetable = ms.vegetable;
  }
  if (ms?.duration) out.duration = ms.duration;
  if (typeof growth?.light === "number") out.light = growth.light;
  if (typeof growth?.atmospheric_humidity === "number") {
    out.atmosphericHumidity = growth.atmospheric_humidity;
  }
  if (typeof growth?.ph_minimum === "number") out.phMin = growth.ph_minimum;
  if (typeof growth?.ph_maximum === "number") out.phMax = growth.ph_maximum;
  const minTemp = unwrapTemp(growth?.minimum_temperature);
  if (minTemp.f !== undefined) out.minimumGrowthTempF = minTemp.f;
  if (minTemp.c !== undefined) out.minimumGrowthTempC = minTemp.c;
  const maxTemp = unwrapTemp(growth?.maximum_temperature);
  if (maxTemp.f !== undefined) out.maximumGrowthTempF = maxTemp.f;
  if (maxTemp.c !== undefined) out.maximumGrowthTempC = maxTemp.c;
  if (typeof growth?.days_to_harvest === "number") {
    out.daysToHarvest = growth.days_to_harvest;
  }
  if (typeof growth?.sowing === "string" && growth.sowing.length > 0) {
    out.sowingNotes = growth.sowing;
  }
  if (growth?.growth_months) out.growthMonths = growth.growth_months;
  if (growth?.bloom_months) out.bloomMonths = growth.bloom_months;
  if (growth?.fruit_months) out.fruitMonths = growth.fruit_months;
  if (specs?.growth_habit) out.growthHabit = specs.growth_habit;
  if (specs?.growth_rate) out.growthRate = specs.growth_rate;
  if (flower?.color) out.flowerColors = flower.color;
  const img = ms?.image_url ?? plant.image_url;
  if (img) out.imageUrl = img;

  return ok(out);
}

function unwrapTemp(
  t:
    | { deg_c: number | null; deg_f: number | null }
    | null
    | undefined
    // Trefle sometimes returns a bare null instead of the wrapper object.
    | unknown,
): { f?: number; c?: number } {
  const out: { f?: number; c?: number } = {};
  if (!t || typeof t !== "object") return out;
  const obj = t as { deg_c?: number | null; deg_f?: number | null };
  if (typeof obj.deg_f === "number") out.f = obj.deg_f;
  if (typeof obj.deg_c === "number") out.c = obj.deg_c;
  return out;
}
