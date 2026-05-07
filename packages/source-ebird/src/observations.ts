import { err, ok, type Observation, type Result } from "@pondlog/core";
import { ebirdFetch } from "./client.js";
import { normalizeObservation } from "./normalize.js";
import { EbirdObservationListSchema, type EbirdObservation } from "./schemas.js";

export interface RecentObservationsParams {
  /** Days back to include (1–30). Default eBird = 14. */
  back?: number;
  /** Restrict to one or more region/locId codes. */
  cat?: "domestic" | "form" | "hybrid" | "intergrade" | "issf" | "slash" | "species" | "spuh";
  /** Hotspots only. */
  hotspot?: boolean;
  /** Include provisional (unreviewed). */
  includeProvisional?: boolean;
  /** Max results (1–10000). */
  maxResults?: number;
  /** Restrict to specific locIds. */
  r?: string | string[];
  /** Common name locale. */
  sppLocale?: string;
}

export interface NotableObservationsParams extends RecentObservationsParams {
  /** "simple" or "full" detail. Default simple. */
  detail?: "simple" | "full";
}

export interface NearbyObservationsParams extends RecentObservationsParams {
  /** Search radius in km (0–50). Default 25. */
  dist?: number;
  /** Sort: date (default) or species. */
  sort?: "date" | "species";
}

export interface NearbyNotableParams extends NearbyObservationsParams {
  detail?: "simple" | "full";
}

export interface NearbyOfSpeciesParams extends NearbyObservationsParams {
  /** No "sort" — fixed by API. */
}

export interface HistoricObservationsParams {
  back?: never;
  cat?: RecentObservationsParams["cat"];
  detail?: "simple" | "full";
  hotspot?: boolean;
  includeProvisional?: boolean;
  maxResults?: number;
  r?: string | string[];
  /** Return only most-recent observation per species ("create"|"mrec"). */
  rank?: "mrec" | "create";
  sppLocale?: string;
}

function clampBack(back: number | undefined): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (back === undefined) return { ok: true, value: undefined };
  if (!Number.isFinite(back) || back < 1 || back > 30) {
    return { ok: false, error: `back must be between 1 and 30, got ${back}` };
  }
  return { ok: true, value: Math.floor(back) };
}

function clampDist(dist: number | undefined): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (dist === undefined) return { ok: true, value: undefined };
  if (!Number.isFinite(dist) || dist < 0 || dist > 50) {
    return { ok: false, error: `dist must be between 0 and 50 km, got ${dist}` };
  }
  return { ok: true, value: dist };
}

function joinR(r: string | string[] | undefined): string | undefined {
  if (!r) return undefined;
  return Array.isArray(r) ? r.join(",") : r;
}

function recentSearchParams(p: RecentObservationsParams): Record<string, string | number | boolean | undefined> {
  return {
    back: p.back,
    cat: p.cat,
    hotspot: p.hotspot,
    includeProvisional: p.includeProvisional,
    maxResults: p.maxResults,
    r: joinR(p.r),
    sppLocale: p.sppLocale,
  };
}

// 1. GET /data/obs/{regionCode}/recent
export async function getRecentObservations(
  regionCode: string,
  params: RecentObservationsParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });

  const result = await ebirdFetch(
    `/data/obs/${encodeURIComponent(regionCode)}/recent`,
    EbirdObservationListSchema,
    { searchParams: { ...recentSearchParams(params), back: back.value } },
  );
  return result;
}

// 2. GET /data/obs/{regionCode}/recent/notable
export async function getRecentNotable(
  regionCode: string,
  params: NotableObservationsParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });

  return ebirdFetch(
    `/data/obs/${encodeURIComponent(regionCode)}/recent/notable`,
    EbirdObservationListSchema,
    { searchParams: { ...recentSearchParams(params), back: back.value, detail: params.detail } },
  );
}

// 3. GET /data/obs/{regionCode}/recent/{speciesCode}
export async function getRecentOfSpecies(
  regionCode: string,
  speciesCode: string,
  params: RecentObservationsParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });

  return ebirdFetch(
    `/data/obs/${encodeURIComponent(regionCode)}/recent/${encodeURIComponent(speciesCode)}`,
    EbirdObservationListSchema,
    { searchParams: { ...recentSearchParams(params), back: back.value } },
  );
}

// 4. GET /data/obs/geo/recent
export async function getNearbyRecent(
  lat: number,
  lng: number,
  params: NearbyObservationsParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });
  const dist = clampDist(params.dist);
  if (!dist.ok) return err({ source: "ebird", message: dist.error });

  return ebirdFetch("/data/obs/geo/recent", EbirdObservationListSchema, {
    searchParams: {
      lat,
      lng,
      ...recentSearchParams(params),
      back: back.value,
      dist: dist.value,
      sort: params.sort,
    },
  });
}

// 5. GET /data/obs/geo/recent/notable
export async function getNearbyNotable(
  lat: number,
  lng: number,
  params: NearbyNotableParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });
  const dist = clampDist(params.dist);
  if (!dist.ok) return err({ source: "ebird", message: dist.error });

  return ebirdFetch("/data/obs/geo/recent/notable", EbirdObservationListSchema, {
    searchParams: {
      lat,
      lng,
      ...recentSearchParams(params),
      back: back.value,
      dist: dist.value,
      detail: params.detail,
    },
  });
}

// 6. GET /data/obs/geo/recent/{speciesCode}
export async function getNearbyOfSpecies(
  lat: number,
  lng: number,
  speciesCode: string,
  params: NearbyOfSpeciesParams = {},
): Promise<Result<EbirdObservation[]>> {
  const back = clampBack(params.back);
  if (!back.ok) return err({ source: "ebird", message: back.error });
  const dist = clampDist(params.dist);
  if (!dist.ok) return err({ source: "ebird", message: dist.error });

  return ebirdFetch(
    `/data/obs/geo/recent/${encodeURIComponent(speciesCode)}`,
    EbirdObservationListSchema,
    {
      searchParams: {
        lat,
        lng,
        ...recentSearchParams(params),
        back: back.value,
        dist: dist.value,
      },
    },
  );
}

// 7. GET /data/obs/{regionCode}/historic/{y}/{m}/{d}
export async function getHistoricOnDate(
  regionCode: string,
  year: number,
  month: number,
  day: number,
  params: HistoricObservationsParams = {},
): Promise<Result<EbirdObservation[]>> {
  if (!Number.isInteger(year) || year < 1800) {
    return err({ source: "ebird", message: `year must be an integer >= 1800, got ${year}` });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return err({ source: "ebird", message: `month must be 1–12, got ${month}` });
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return err({ source: "ebird", message: `day must be 1–31, got ${day}` });
  }

  return ebirdFetch(
    `/data/obs/${encodeURIComponent(regionCode)}/historic/${year}/${month}/${day}`,
    EbirdObservationListSchema,
    {
      searchParams: {
        cat: params.cat,
        detail: params.detail,
        hotspot: params.hotspot,
        includeProvisional: params.includeProvisional,
        maxResults: params.maxResults,
        r: joinR(params.r),
        rank: params.rank,
        sppLocale: params.sppLocale,
      },
    },
  );
}

// Convenience: normalized variants (return shared @pondlog/core Observation)
export async function getNearbyRecentNormalized(
  lat: number,
  lng: number,
  params: NearbyObservationsParams = {},
): Promise<Result<Observation[]>> {
  const result = await getNearbyRecent(lat, lng, params);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeObservation));
}

export async function getNearbyNotableNormalized(
  lat: number,
  lng: number,
  params: NearbyNotableParams = {},
): Promise<Result<Observation[]>> {
  const result = await getNearbyNotable(lat, lng, params);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeObservation));
}
