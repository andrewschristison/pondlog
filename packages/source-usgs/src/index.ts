import { err, ok, type Result } from "@pondlog/core";
import {
  usgsFetchJson,
  usgsFetchText,
  type UsgsFetchOptions,
} from "./client.js";
import {
  groupBySite,
  normalizeRdbSite,
  parseRdb,
  type NormalizedUsgsReading,
  type NormalizedUsgsSiteRecord,
} from "./normalize.js";
import { UsgsResponseSchema } from "./schemas.js";

export type {
  NormalizedUsgsReading,
  NormalizedUsgsSeries,
  NormalizedUsgsSite,
  NormalizedUsgsSiteRecord,
  NormalizedUsgsValue,
} from "./normalize.js";
export {
  UsgsResponseSchema,
  UsgsTimeSeriesSchema,
  UsgsValueSchema,
} from "./schemas.js";
export type { UsgsResponse, UsgsTimeSeries, UsgsValue } from "./schemas.js";

const SITE_NUMBER_RE = /^[0-9]{8,15}$/;
const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PERIOD_RE = /^P(?:T?\d+[YMDHS])+$/;
const US_STATE_CODE = /^[A-Z]{2}$/;

/** USGS parameter codes most callers want. Extend as needed. */
export const PARAMETER_CODES = {
  /** Discharge / streamflow, ft³/s. */
  DISCHARGE: "00060",
  /** Gage height, ft. */
  GAGE_HEIGHT: "00065",
  /** Water temperature, °C. */
  WATER_TEMP_C: "00010",
} as const;

// ----------------------------------------------------------------------------
// Shared parameter validation
// ----------------------------------------------------------------------------

function validateSites(sites: string[]): Result<true> {
  if (!Array.isArray(sites) || sites.length === 0) {
    return err({
      source: "usgs",
      message: "sites must be a non-empty array of USGS site numbers",
    });
  }
  for (const s of sites) {
    if (!SITE_NUMBER_RE.test(s)) {
      return err({
        source: "usgs",
        message: `invalid USGS site number "${s}" — expected 8–15 digits (e.g. "12045500")`,
      });
    }
  }
  return ok(true);
}

function validateParameterCodes(codes: string[] | undefined): Result<true> {
  if (codes === undefined) return ok(true);
  if (!Array.isArray(codes) || codes.length === 0) {
    return err({
      source: "usgs",
      message: "parameterCodes, when provided, must be a non-empty array",
    });
  }
  for (const c of codes) {
    if (!/^[0-9]{5}$/.test(c)) {
      return err({
        source: "usgs",
        message: `invalid parameter code "${c}" — expected 5 digits (e.g. "00060" for discharge)`,
      });
    }
  }
  return ok(true);
}

function validateTimeWindow(opts: {
  period?: string;
  startDt?: string;
  endDt?: string;
}): Result<true> {
  const hasPeriod = typeof opts.period === "string" && opts.period.length > 0;
  const hasRange =
    typeof opts.startDt === "string" || typeof opts.endDt === "string";
  if (hasPeriod && hasRange) {
    return err({
      source: "usgs",
      message: "pass either `period` or `startDt`/`endDt`, not both",
    });
  }
  if (hasPeriod && !PERIOD_RE.test(opts.period as string)) {
    return err({
      source: "usgs",
      message: `invalid period "${opts.period}" — expected ISO-8601 duration (e.g. "P7D", "PT2H")`,
    });
  }
  if (typeof opts.startDt === "string" && !ISO_DATE_RE.test(opts.startDt)) {
    return err({
      source: "usgs",
      message: `invalid startDt "${opts.startDt}" — expected YYYY-MM-DD`,
    });
  }
  if (typeof opts.endDt === "string" && !ISO_DATE_RE.test(opts.endDt)) {
    return err({
      source: "usgs",
      message: `invalid endDt "${opts.endDt}" — expected YYYY-MM-DD`,
    });
  }
  return ok(true);
}

function buildTimeSeriesParams(opts: {
  sites: string[];
  parameterCodes?: string[];
  period?: string;
  startDt?: string;
  endDt?: string;
}): Record<string, string> {
  const params: Record<string, string> = {
    sites: opts.sites.join(","),
    format: "json",
  };
  if (opts.parameterCodes && opts.parameterCodes.length > 0) {
    params.parameterCd = opts.parameterCodes.join(",");
  }
  if (opts.period) params.period = opts.period;
  if (opts.startDt) params.startDT = opts.startDt;
  if (opts.endDt) params.endDT = opts.endDt;
  return params;
}

// ----------------------------------------------------------------------------
// 1. getInstantaneousValues — real-time readings (15-min cadence at most sites)
// ----------------------------------------------------------------------------

export interface GetInstantaneousValuesParams {
  /** USGS site numbers (8–15 digits each). At least one required. */
  sites: string[];
  /** USGS parameter codes (5 digits each). Defaults to ["00060", "00065"]. */
  parameterCodes?: string[];
  /** ISO-8601 duration ending now, e.g. "PT2H", "P1D", "P7D". Defaults to "PT2H". */
  period?: string;
  /** Override the default 30s timeout. */
  timeoutMs?: number;
}

/** Real-time gauge readings (typically 15-minute cadence). USGS rejects historic
 *  startDT/endDT on /iv/ — use period (relative-to-now) instead. For historic
 *  data use `getDailyValues`. */
export async function getInstantaneousValues(
  params: GetInstantaneousValuesParams,
): Promise<Result<NormalizedUsgsReading[]>> {
  const sg = validateSites(params.sites);
  if (!sg.ok) return sg;
  const pg = validateParameterCodes(params.parameterCodes);
  if (!pg.ok) return pg;
  const period = params.period ?? "PT2H";
  const tg = validateTimeWindow({ period });
  if (!tg.ok) return tg;

  const fetchOpts: UsgsFetchOptions = {
    searchParams: buildTimeSeriesParams({
      sites: params.sites,
      parameterCodes: params.parameterCodes ?? ["00060", "00065"],
      period,
    }),
  };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;

  const result = await usgsFetchJson("/iv/", UsgsResponseSchema, fetchOpts);
  if (!result.ok) return result;
  return ok(groupBySite(result.data.value.timeSeries));
}

// ----------------------------------------------------------------------------
// 2. getDailyValues — daily statistics (mean, min, max)
// ----------------------------------------------------------------------------

export interface GetDailyValuesParams {
  sites: string[];
  parameterCodes?: string[];
  /** ISO-8601 duration. Defaults to "P7D". Mutually exclusive with startDt/endDt. */
  period?: string;
  /** YYYY-MM-DD. Mutually exclusive with `period`. */
  startDt?: string;
  /** YYYY-MM-DD. Mutually exclusive with `period`. Defaults to today when startDt set. */
  endDt?: string;
  /** Statistic codes — "00003" = mean (default), "00001" = max, "00002" = min. */
  statisticCodes?: string[];
  timeoutMs?: number;
}

export async function getDailyValues(
  params: GetDailyValuesParams,
): Promise<Result<NormalizedUsgsReading[]>> {
  const sg = validateSites(params.sites);
  if (!sg.ok) return sg;
  const pg = validateParameterCodes(params.parameterCodes);
  if (!pg.ok) return pg;
  const period = params.period ?? (params.startDt ? undefined : "P7D");
  const tg = validateTimeWindow({
    ...(period !== undefined ? { period } : {}),
    ...(params.startDt !== undefined ? { startDt: params.startDt } : {}),
    ...(params.endDt !== undefined ? { endDt: params.endDt } : {}),
  });
  if (!tg.ok) return tg;

  const search = buildTimeSeriesParams({
    sites: params.sites,
    parameterCodes: params.parameterCodes ?? ["00060"],
    ...(period !== undefined ? { period } : {}),
    ...(params.startDt !== undefined ? { startDt: params.startDt } : {}),
    ...(params.endDt !== undefined ? { endDt: params.endDt } : {}),
  });
  if (params.statisticCodes && params.statisticCodes.length > 0) {
    search.statCd = params.statisticCodes.join(",");
  }

  const fetchOpts: UsgsFetchOptions = { searchParams: search };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;

  const result = await usgsFetchJson("/dv/", UsgsResponseSchema, fetchOpts);
  if (!result.ok) return result;
  return ok(groupBySite(result.data.value.timeSeries));
}

// ----------------------------------------------------------------------------
// 3. getSiteInfo — metadata for a single site (RDB endpoint)
// ----------------------------------------------------------------------------

export interface GetSiteInfoParams {
  siteNumber: string;
  timeoutMs?: number;
}

export async function getSiteInfo(
  params: GetSiteInfoParams,
): Promise<Result<NormalizedUsgsSiteRecord>> {
  const sg = validateSites([params.siteNumber]);
  if (!sg.ok) return sg;
  const fetchOpts: UsgsFetchOptions = {
    searchParams: {
      sites: params.siteNumber,
      format: "rdb",
      siteOutput: "expanded",
    },
  };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;
  const text = await usgsFetchText("/site/", fetchOpts);
  if (!text.ok) return text;
  const rows = parseRdb(text.data);
  const row = rows[0];
  if (!row) {
    return err({
      source: "usgs",
      message: `no site found for ${params.siteNumber}`,
    });
  }
  return ok(normalizeRdbSite(row));
}

// ----------------------------------------------------------------------------
// 4. searchSites — find sites by bbox, state, or HUC
// ----------------------------------------------------------------------------

export interface SearchSitesParams {
  /** Bounding box [westLng, southLat, eastLng, northLat]. */
  bbox?: [number, number, number, number];
  /** US two-letter state postal code. */
  stateCode?: string;
  /** Hydrologic Unit Code (2–8 digits). */
  hucCode?: string;
  /** Site type filter, e.g. "ST" (stream), "LK" (lake), "GW" (groundwater). Default "ST". */
  siteType?: string;
  /** Restrict to sites with the given data type. "iv" = instantaneous, "dv" = daily. Default "iv". */
  hasDataTypeCode?: string;
  timeoutMs?: number;
}

export async function searchSites(
  params: SearchSitesParams,
): Promise<Result<NormalizedUsgsSiteRecord[]>> {
  if (!params.bbox && !params.stateCode && !params.hucCode) {
    return err({
      source: "usgs",
      message:
        "searchSites: at least one of bbox, stateCode, or hucCode is required",
    });
  }
  if (
    params.stateCode !== undefined &&
    !US_STATE_CODE.test(params.stateCode)
  ) {
    return err({
      source: "usgs",
      message: `invalid stateCode "${params.stateCode}" — expected US two-letter postal code (e.g. "WA")`,
    });
  }
  if (params.bbox) {
    const [w, s, e, n] = params.bbox;
    if (
      !Number.isFinite(w) ||
      !Number.isFinite(s) ||
      !Number.isFinite(e) ||
      !Number.isFinite(n)
    ) {
      return err({
        source: "usgs",
        message: "bbox must be four finite numbers [westLng, southLat, eastLng, northLat]",
      });
    }
    if (w >= e || s >= n) {
      return err({
        source: "usgs",
        message: "bbox must satisfy westLng < eastLng and southLat < northLat",
      });
    }
    if (e - w > 7 || n - s > 7) {
      return err({
        source: "usgs",
        message: "bbox dimensions cannot exceed 7° (USGS API limit)",
      });
    }
  }

  const search: Record<string, string> = {
    format: "rdb",
    siteOutput: "basic",
    siteType: params.siteType ?? "ST",
    hasDataTypeCd: params.hasDataTypeCode ?? "iv",
  };
  if (params.bbox) {
    search.bBox = params.bbox.join(",");
  }
  if (params.stateCode) search.stateCd = params.stateCode;
  if (params.hucCode) search.huc = params.hucCode;

  const fetchOpts: UsgsFetchOptions = { searchParams: search };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;

  const text = await usgsFetchText("/site/", fetchOpts);
  if (!text.ok) return text;
  const rows = parseRdb(text.data);
  return ok(rows.map(normalizeRdbSite));
}

// ----------------------------------------------------------------------------
// Helpers re-exported for callers that want to build their own bbox queries.
// ----------------------------------------------------------------------------

/** Build a square bbox tuple [westLng, southLat, eastLng, northLat] around a
 *  point with the given radius in km. Useful for `searchSites({ bbox })`. */
export function bboxAround(
  coords: { lat: number; lng: number },
  radiusKm: number,
): [number, number, number, number] {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error(`bboxAround: radiusKm must be positive, got ${radiusKm}`);
  }
  const latDelta = radiusKm / 111.32;
  const lngDelta =
    radiusKm / (111.32 * Math.cos((coords.lat * Math.PI) / 180));
  // USGS rejects bbox values with more than 7 digits after the decimal.
  const round7 = (n: number): number => Math.round(n * 1e7) / 1e7;
  return [
    round7(coords.lng - lngDelta),
    round7(coords.lat - latDelta),
    round7(coords.lng + lngDelta),
    round7(coords.lat + latDelta),
  ];
}
