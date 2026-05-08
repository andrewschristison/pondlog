import { err, ok, type Coordinates, type Result } from "@pondlog/core";
import { moFetch, type MoFetchOptions } from "./client.js";
import {
  normalizeLocation,
  normalizeName,
  normalizeObservation,
  type NormalizedMoLocation,
  type NormalizedMoName,
  type NormalizedMoObservation,
} from "./normalize.js";
import {
  MoLocationEnvelope,
  MoNameEnvelope,
  MoObservationEnvelope,
} from "./schemas.js";

export type {
  NormalizedMoLocation,
  NormalizedMoName,
  NormalizedMoObservation,
} from "./normalize.js";
export type {
  MoLocation,
  MoLocationEmbedded,
  MoName,
  MoObservation,
} from "./schemas.js";
export {
  MoLocationEnvelope,
  MoLocationSchema,
  MoNameEnvelope,
  MoNameSchema,
  MoObservationEnvelope,
  MoObservationSchema,
} from "./schemas.js";
export { stripHtml } from "./normalize.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED_RANKS = [
  "Class",
  "Domain",
  "Family",
  "Form",
  "Genus",
  "Group",
  "Kingdom",
  "Order",
  "Phylum",
  "Section",
  "Series",
  "Species",
  "Stirps",
  "Subclass",
  "Subfamily",
  "Subgenus",
  "Suborder",
  "Subphylum",
  "Subsection",
  "Subspecies",
  "Subtribe",
  "Tribe",
  "Variety",
] as const;
export type MoNameRank = (typeof SUPPORTED_RANKS)[number];

// ----------------------------------------------------------------------------
// Spatial helper — bbox tuple around coords, identical math to source-usgs.
// ----------------------------------------------------------------------------

export interface MoBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function bboxAround(coords: Coordinates, radiusKm: number): MoBbox {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error(`bboxAround: radiusKm must be positive, got ${radiusKm}`);
  }
  const latDelta = radiusKm / 111.32;
  const lngDelta =
    radiusKm / (111.32 * Math.cos((coords.lat * Math.PI) / 180));
  // Round to 6 decimal places — same precision MO accepts.
  const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
  return {
    north: round6(coords.lat + latDelta),
    south: round6(coords.lat - latDelta),
    east: round6(coords.lng + lngDelta),
    west: round6(coords.lng - lngDelta),
  };
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDate(): Date {
  return new Date();
}

function nDaysAgo(n: number, ref: Date = todayDate()): Date {
  const out = new Date(ref);
  out.setUTCDate(out.getUTCDate() - n);
  return out;
}

// ----------------------------------------------------------------------------
// 1. searchObservations
// ----------------------------------------------------------------------------

export interface SearchObservationsParams {
  /** Center for a bbox query. Combine with `radiusKm`. */
  coords?: Coordinates;
  radiusKm?: number;
  /** MO `region` filter — suffix match against location names (e.g.
   *  "Clallam Co., Washington, USA"). */
  region?: string;
  /** Substring match against the consensus name (uses MO `name` filter). */
  name?: string;
  /** Minimum vote-weighted confidence in [-3..3]. */
  confidenceMin?: number;
  /** ISO date range. Both ends inclusive. */
  dateFrom?: string;
  dateTo?: string;
  hasImages?: boolean;
  includeSubtaxa?: boolean;
  /** 1-indexed page number. Default 1. */
  page?: number;
  /** Detail level, default "low". */
  detail?: "low" | "high";
}

export interface SearchObservationsResult {
  observations: NormalizedMoObservation[];
  numberOfRecords: number;
  numberOfPages: number;
  pageNumber: number;
}

export async function searchObservations(
  params: SearchObservationsParams,
): Promise<Result<SearchObservationsResult>> {
  const guard = guardObservationsParams(params);
  if (!guard.ok) return guard;

  const search: Record<string, string | number | boolean | undefined> = {
    detail: params.detail ?? "low",
    page: params.page ?? 1,
  };
  if (params.coords && params.radiusKm) {
    const box = bboxAround(params.coords, params.radiusKm);
    search.north = box.north;
    search.south = box.south;
    search.east = box.east;
    search.west = box.west;
  }
  if (params.region) search.region = params.region;
  if (params.name) search.name = params.name;
  if (params.confidenceMin !== undefined) {
    // MO accepts a range like "1..3" — treat the parameter as an inclusive lower bound.
    search.confidence = `${params.confidenceMin}..3`;
  }
  if (params.dateFrom && params.dateTo) {
    search.date = `${params.dateFrom}-${params.dateTo}`;
  } else if (params.dateFrom) {
    search.date = `${params.dateFrom}-${isoDate(todayDate())}`;
  }
  if (params.hasImages !== undefined) search.has_images = params.hasImages;
  if (params.includeSubtaxa !== undefined)
    search.include_subtaxa = params.includeSubtaxa;

  const fetchOpts: MoFetchOptions = { searchParams: search };
  const result = await moFetch(
    "/observations",
    MoObservationEnvelope,
    fetchOpts,
  );
  if (!result.ok) return result;
  const rows = result.data.results ?? [];

  return ok({
    observations: rows.map(normalizeObservation),
    numberOfRecords: result.data.number_of_records ?? rows.length,
    numberOfPages: result.data.number_of_pages ?? 1,
    pageNumber: result.data.page_number ?? 1,
  });
}

function guardObservationsParams(
  params: SearchObservationsParams,
): Result<true> {
  const hasCoords =
    params.coords !== undefined &&
    Number.isFinite(params.coords.lat) &&
    Number.isFinite(params.coords.lng);
  const hasRadius =
    typeof params.radiusKm === "number" &&
    Number.isFinite(params.radiusKm) &&
    params.radiusKm > 0;
  if (hasCoords !== hasRadius) {
    return err({
      source: "mushroomobserver",
      message:
        "searchObservations: provide both coords and radiusKm, or neither",
    });
  }
  const hasRegion = typeof params.region === "string" && params.region.length > 0;
  const hasName = typeof params.name === "string" && params.name.length > 0;
  const hasDate =
    typeof params.dateFrom === "string" || typeof params.dateTo === "string";
  if (!hasCoords && !hasRegion && !hasName && !hasDate) {
    return err({
      source: "mushroomobserver",
      message:
        "searchObservations: at least one of {coords+radiusKm, region, name, dateFrom/dateTo} is required (MO has 27,000+ records in some regions and unbounded queries return tens of MB)",
    });
  }
  for (const dateField of ["dateFrom", "dateTo"] as const) {
    const v = params[dateField];
    if (v !== undefined && !ISO_DATE_RE.test(v)) {
      return err({
        source: "mushroomobserver",
        message: `searchObservations: ${dateField} must be YYYY-MM-DD, got "${v}"`,
      });
    }
  }
  if (
    params.confidenceMin !== undefined &&
    (params.confidenceMin < -3 || params.confidenceMin > 3)
  ) {
    return err({
      source: "mushroomobserver",
      message: `searchObservations: confidenceMin must be in [-3..3], got ${params.confidenceMin}`,
    });
  }
  if (
    params.page !== undefined &&
    (!Number.isInteger(params.page) || params.page < 1)
  ) {
    return err({
      source: "mushroomobserver",
      message: `searchObservations: page must be a positive integer, got ${params.page}`,
    });
  }
  return ok(true);
}

// ----------------------------------------------------------------------------
// 2. getObservation
// ----------------------------------------------------------------------------

export async function getObservation(
  id: number,
): Promise<Result<NormalizedMoObservation>> {
  if (!Number.isInteger(id) || id <= 0) {
    return err({
      source: "mushroomobserver",
      message: `getObservation: id must be a positive integer, got ${id}`,
    });
  }
  const result = await moFetch("/observations", MoObservationEnvelope, {
    searchParams: { id, detail: "high" },
  });
  if (!result.ok) return result;
  const first = (result.data.results ?? [])[0];
  if (!first) {
    return err({
      source: "mushroomobserver",
      message: `getObservation: no observation with id ${id}`,
      statusCode: 404,
    });
  }
  return ok(normalizeObservation(first));
}

// ----------------------------------------------------------------------------
// 3. searchNames
// ----------------------------------------------------------------------------

export interface SearchNamesParams {
  /** Substring match against the scientific binomial via MO's
   *  `text_name_has` filter. */
  query?: string;
  rank?: MoNameRank;
  includeSubtaxa?: boolean;
  page?: number;
}

export interface SearchNamesResult {
  names: NormalizedMoName[];
  numberOfRecords: number;
  numberOfPages: number;
  pageNumber: number;
}

export async function searchNames(
  params: SearchNamesParams,
): Promise<Result<SearchNamesResult>> {
  if (
    (params.query === undefined || params.query.length === 0) &&
    params.rank === undefined
  ) {
    return err({
      source: "mushroomobserver",
      message: "searchNames: at least one of {query, rank} is required",
    });
  }
  const search: Record<string, string | number | boolean | undefined> = {
    detail: "low",
    page: params.page ?? 1,
  };
  if (params.query) search.text_name_has = params.query;
  if (params.rank) search.rank = params.rank;
  if (params.includeSubtaxa !== undefined)
    search.include_subtaxa = params.includeSubtaxa;

  const result = await moFetch("/names", MoNameEnvelope, { searchParams: search });
  if (!result.ok) return result;
  const rows = result.data.results ?? [];
  return ok({
    names: rows.map(normalizeName),
    numberOfRecords: result.data.number_of_records ?? rows.length,
    numberOfPages: result.data.number_of_pages ?? 1,
    pageNumber: result.data.page_number ?? 1,
  });
}

// ----------------------------------------------------------------------------
// 4. searchRegions — discover MO location-name suffixes (no /locations endpoint
//    name search exists; we harvest from observations).
// ----------------------------------------------------------------------------

export interface SearchRegionsParams {
  /** Suffix string to match observation locations against (e.g. "Washington, USA"). */
  query: string;
  /** Max pages of observations to scan. Default 2. Cap 5. */
  maxPages?: number;
}

export interface RegionMatch {
  /** The matched `location_name` string. */
  name: string;
  /** How many observations across the scanned pages used this name. */
  count: number;
}

export interface SearchRegionsResult {
  query: string;
  pagesScanned: number;
  totalObservations: number;
  regions: RegionMatch[];
}

export async function searchRegions(
  params: SearchRegionsParams,
): Promise<Result<SearchRegionsResult>> {
  const query = (params.query ?? "").trim();
  if (query.length === 0) {
    return err({
      source: "mushroomobserver",
      message: "searchRegions: query is required",
    });
  }
  const maxPages = Math.min(Math.max(params.maxPages ?? 2, 1), 5);
  const counts = new Map<string, number>();
  let totalObservations = 0;
  let pagesScanned = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res = await moFetch("/observations", MoObservationEnvelope, {
      searchParams: { region: query, detail: "low", page },
    });
    if (!res.ok) return res;
    pagesScanned++;
    totalObservations = res.data.number_of_records ?? totalObservations;
    const rows = res.data.results ?? [];
    for (const obs of rows) {
      const name = obs.location_name ?? obs.location?.name;
      if (name && name.length > 0) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const totalPages = res.data.number_of_pages ?? 1;
    if (page >= totalPages) break;
  }
  const regions: RegionMatch[] = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return ok({ query, pagesScanned, totalObservations, regions });
}

// ----------------------------------------------------------------------------
// 5. getRecentNearLocation — sugar for "what's fruiting near me"
// ----------------------------------------------------------------------------

export interface GetRecentNearLocationParams {
  /** Provide either coords+radiusKm OR region. */
  coords?: Coordinates;
  radiusKm?: number;
  region?: string;
  /** Window (days back from today). Default 30. */
  days?: number;
  /** Cap on records returned. Default 50. */
  limit?: number;
  /** Filter by minimum vote-weighted confidence. Default no filter. */
  confidenceMin?: number;
}

export interface RecentFungiResult {
  observations: NormalizedMoObservation[];
  /** Total matching records on the server (across all pages, not just the
   *  ones in `observations`). */
  totalRecords: number;
  windowDays: number;
}

export async function getRecentNearLocation(
  params: GetRecentNearLocationParams,
): Promise<Result<RecentFungiResult>> {
  const days = params.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return err({
      source: "mushroomobserver",
      message: `getRecentNearLocation: days must be an integer in [1..365], got ${days}`,
    });
  }
  const limit = params.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return err({
      source: "mushroomobserver",
      message: `getRecentNearLocation: limit must be in [1..200], got ${limit}`,
    });
  }

  const dateFrom = isoDate(nDaysAgo(days));
  const dateTo = isoDate(todayDate());

  const baseParams: SearchObservationsParams = {
    dateFrom,
    dateTo,
    hasImages: undefined,
    page: 1,
    detail: "low",
  };
  if (params.confidenceMin !== undefined)
    baseParams.confidenceMin = params.confidenceMin;
  if (params.coords && params.radiusKm) {
    baseParams.coords = params.coords;
    baseParams.radiusKm = params.radiusKm;
  } else if (params.region) {
    baseParams.region = params.region;
  } else {
    return err({
      source: "mushroomobserver",
      message:
        "getRecentNearLocation: provide either coords+radiusKm or region",
    });
  }

  const out: NormalizedMoObservation[] = [];
  let total = 0;
  let nextPage = 1;
  let totalPages = 1;
  while (out.length < limit && nextPage <= totalPages && nextPage <= 5) {
    const next: SearchObservationsParams = { ...baseParams, page: nextPage };
    const res = await searchObservations(next);
    if (!res.ok) return res;
    total = res.data.numberOfRecords;
    totalPages = res.data.numberOfPages;
    for (const o of res.data.observations) {
      out.push(o);
      if (out.length >= limit) break;
    }
    if (res.data.observations.length === 0) break;
    nextPage++;
  }

  return ok({ observations: out, totalRecords: total, windowDays: days });
}

// ----------------------------------------------------------------------------
// 6. getSpeciesCountByLocation
// ----------------------------------------------------------------------------

export interface GetSpeciesCountByLocationParams {
  coords?: Coordinates;
  radiusKm?: number;
  region?: string;
  /** Window in days back from today. Default 365. */
  daysBack?: number;
  /** Cap on pages scanned (each page = 100 obs). Default 3. Max 10. */
  maxPages?: number;
}

export interface MoSpeciesCount {
  consensusName: string;
  count: number;
  /** Highest-confidence observation we saw for this taxon. */
  topObservationId: number;
  topConfidence: number;
}

export interface SpeciesCountResult {
  observationsScanned: number;
  totalObservations: number;
  pagesScanned: number;
  windowDays: number;
  counts: MoSpeciesCount[];
}

export async function getSpeciesCountByLocation(
  params: GetSpeciesCountByLocationParams,
): Promise<Result<SpeciesCountResult>> {
  const daysBack = params.daysBack ?? 365;
  if (!Number.isInteger(daysBack) || daysBack < 1 || daysBack > 3650) {
    return err({
      source: "mushroomobserver",
      message: `getSpeciesCountByLocation: daysBack must be in [1..3650], got ${daysBack}`,
    });
  }
  const maxPages = Math.min(Math.max(params.maxPages ?? 3, 1), 10);
  const dateFrom = isoDate(nDaysAgo(daysBack));
  const dateTo = isoDate(todayDate());

  const baseParams: SearchObservationsParams = {
    dateFrom,
    dateTo,
    detail: "low",
  };
  if (params.coords && params.radiusKm) {
    baseParams.coords = params.coords;
    baseParams.radiusKm = params.radiusKm;
  } else if (params.region) {
    baseParams.region = params.region;
  } else {
    return err({
      source: "mushroomobserver",
      message:
        "getSpeciesCountByLocation: provide either coords+radiusKm or region",
    });
  }

  const counts = new Map<string, MoSpeciesCount>();
  let scanned = 0;
  let total = 0;
  let pages = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res = await searchObservations({ ...baseParams, page });
    if (!res.ok) return res;
    pages++;
    total = res.data.numberOfRecords;
    for (const obs of res.data.observations) {
      scanned++;
      const name = obs.consensusName;
      if (!name) continue;
      const conf = obs.confidence ?? 0;
      const existing = counts.get(name);
      if (existing) {
        existing.count += 1;
        if (conf > existing.topConfidence) {
          existing.topConfidence = conf;
          existing.topObservationId = obs.id;
        }
      } else {
        counts.set(name, {
          consensusName: name,
          count: 1,
          topObservationId: obs.id,
          topConfidence: conf,
        });
      }
    }
    if (page >= res.data.numberOfPages) break;
    if (res.data.observations.length === 0) break;
  }

  const sorted = Array.from(counts.values()).sort(
    (a, b) =>
      b.count - a.count ||
      b.topConfidence - a.topConfidence ||
      a.consensusName.localeCompare(b.consensusName),
  );

  return ok({
    observationsScanned: scanned,
    totalObservations: total,
    pagesScanned: pages,
    windowDays: daysBack,
    counts: sorted,
  });
}

// ----------------------------------------------------------------------------
// 7. getLocationsInBbox — direct hit on /locations (no name search exists)
// ----------------------------------------------------------------------------

export async function getLocationsInBbox(
  bbox: MoBbox,
): Promise<Result<NormalizedMoLocation[]>> {
  if (
    !Number.isFinite(bbox.north) ||
    !Number.isFinite(bbox.south) ||
    !Number.isFinite(bbox.east) ||
    !Number.isFinite(bbox.west)
  ) {
    return err({
      source: "mushroomobserver",
      message: "getLocationsInBbox: bbox values must be finite numbers",
    });
  }
  const res = await moFetch("/locations", MoLocationEnvelope, {
    searchParams: {
      north: bbox.north,
      south: bbox.south,
      east: bbox.east,
      west: bbox.west,
    },
  });
  if (!res.ok) return res;
  return ok((res.data.results ?? []).map(normalizeLocation));
}
