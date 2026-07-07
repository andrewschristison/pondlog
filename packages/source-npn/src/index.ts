import {
  err,
  ok,
  type Coordinates,
  type Result,
  type Taxon,
} from "@pondlog/core";
import { z } from "zod";
import {
  expandIndexed,
  joinRawQuery,
  npnFetch,
  type NpnFetchOptions,
} from "./client.js";
import {
  normalizeObservation,
  normalizeSiteLevelData,
  normalizeSpecies,
  normalizeStation,
  type NormalizedNpnObservation,
  type NormalizedSiteLevelData,
  type NormalizedStation,
} from "./normalize.js";
import {
  NpnObservationSchema,
  NpnSiteLevelDataSchema,
  NpnSpeciesSchema,
  NpnStationCountByStateSchema,
  NpnStationSchema,
  NpnStationsByLocationErrorShape,
  type NpnStationCountByState,
} from "./schemas.js";
import { bboxWkt, haversineKm } from "./wkt.js";

export type {
  NormalizedNpnObservation,
  NormalizedSiteLevelData,
  NormalizedStation,
} from "./normalize.js";
export type {
  NpnObservation,
  NpnSiteLevelData,
  NpnSpecies,
  NpnStation,
  NpnStationCountByState,
} from "./schemas.js";
export { bboxWkt, haversineKm } from "./wkt.js";

// Wire-shape arrays used by the top-level endpoints.
const SpeciesListSchema = z.array(NpnSpeciesSchema);
const StationListSchema = z.array(NpnStationSchema);
const StationCountListSchema = z.array(NpnStationCountByStateSchema);
const ObservationListSchema = z.array(NpnObservationSchema);
const SiteLevelDataListSchema = z.array(NpnSiteLevelDataSchema);

// getStationsByLocation can return either a station list or a single-element
// `[{stations:"", response_messages:"..."}]` envelope when the WKT is invalid.
const StationsByLocationSchema = z.union([
  StationListSchema,
  z.array(NpnStationsByLocationErrorShape),
]);

const US_STATE_CODE = /^[A-Z]{2}$/;

// ----------------------------------------------------------------------------
// 1. getSpecies, full NPN species catalog (~1900 records, ~1.6 MB)
// ----------------------------------------------------------------------------

export async function getSpecies(): Promise<Result<Taxon[]>> {
  const result = await npnFetch("/species/getSpecies.json", SpeciesListSchema);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeSpecies));
}

// ----------------------------------------------------------------------------
// 2. getStations, all stations, optionally filtered by state code
// ----------------------------------------------------------------------------

export interface GetStationsParams {
  /** US two-letter state postal code (e.g. "WA"). Strongly recommended, the unfiltered list is ~50k stations. */
  stateCode?: string;
}

export async function getStations(
  params: GetStationsParams = {},
): Promise<Result<NormalizedStation[]>> {
  if (params.stateCode !== undefined && !US_STATE_CODE.test(params.stateCode)) {
    return err({
      source: "npn",
      message: `getStations: stateCode must be a US two-letter postal code, got "${params.stateCode}"`,
    });
  }
  const opts: NpnFetchOptions = {};
  if (params.stateCode) {
    opts.searchParams = { state_code: params.stateCode };
  }
  const result = await npnFetch(
    "/stations/getAllStations.json",
    StationListSchema,
    opts,
  );
  if (!result.ok) return result;
  return ok(result.data.map(normalizeStation));
}

// ----------------------------------------------------------------------------
// 3. getStationCountByState
// ----------------------------------------------------------------------------

export async function getStationCountByState(): Promise<Result<NpnStationCountByState[]>> {
  return npnFetch(
    "/stations/getStationCountByState.json",
    StationCountListSchema,
  );
}

// ----------------------------------------------------------------------------
// 4. getStationsWithSpecies, stations that observe one or more species
// ----------------------------------------------------------------------------

export interface GetStationsWithSpeciesParams {
  speciesIds: number[];
}

export async function getStationsWithSpecies(
  params: GetStationsWithSpeciesParams,
): Promise<Result<NormalizedStation[]>> {
  if (!Array.isArray(params.speciesIds) || params.speciesIds.length === 0) {
    return err({
      source: "npn",
      message: "getStationsWithSpecies: speciesIds must be a non-empty array",
    });
  }
  const rawQuery = expandIndexed("species_id", params.speciesIds);
  const result = await npnFetch(
    "/stations/getStationsWithSpecies.json",
    StationListSchema,
    { rawQuery },
  );
  if (!result.ok) return result;
  return ok(result.data.map(normalizeStation));
}

// ----------------------------------------------------------------------------
// 5. getStationsByLocation. WKT polygon spatial filter
// ----------------------------------------------------------------------------

export interface GetStationsByLocationParams {
  wkt: string;
}

export async function getStationsByLocation(
  params: GetStationsByLocationParams,
): Promise<Result<NormalizedStation[]>> {
  const wkt = (params.wkt ?? "").trim();
  if (!wkt) {
    return err({
      source: "npn",
      message: "getStationsByLocation: wkt is required",
    });
  }
  const result = await npnFetch(
    "/stations/getStationsByLocation.json",
    StationsByLocationSchema,
    { searchParams: { wkt } },
  );
  if (!result.ok) return result;
  // Detect the error envelope NPN returns for invalid WKT.
  const first = result.data[0];
  if (
    first &&
    "response_messages" in first &&
    typeof first.response_messages === "string" &&
    first.response_messages.length > 0
  ) {
    return err({
      source: "npn",
      message: `getStationsByLocation: ${first.response_messages}`,
    });
  }
  // Filter out any error envelopes that happened to coexist with stations.
  const stations = result.data.filter(
    (s): s is z.infer<typeof NpnStationSchema> =>
      typeof (s as { station_id?: unknown }).station_id === "number",
  );
  return ok(stations.map(normalizeStation));
}

// ----------------------------------------------------------------------------
// 6. getObservations, status/intensity records (the core data)
// ----------------------------------------------------------------------------

export interface GetObservationsParams {
  /** Required. Years to scan, e.g. [2024] or [2023, 2024]. */
  years: number[];
  /** At least one of these narrowing filters is required at the source boundary. */
  speciesIds?: number[];
  stationIds?: number[];
  states?: string[];
  genusIds?: number[];
  familyIds?: number[];
  orderIds?: number[];
  classIds?: number[];
  phenophaseIds?: number[];
  /** Bounding box [lowerLeftLat, lowerLeftLng, upperRightLat, upperRightLng]. */
  coords?: [number, number, number, number];
  /** Override the default 60s fetch timeout. Use for large queries. */
  timeoutMs?: number;
}

export async function getObservations(
  params: GetObservationsParams,
): Promise<Result<NormalizedNpnObservation[]>> {
  const guard = guardObservationsParams(params);
  if (!guard.ok) return guard;

  const rawQuery = joinRawQuery([
    expandIndexed("years", params.years),
    params.speciesIds && params.speciesIds.length > 0
      ? expandIndexed("species_id", params.speciesIds)
      : undefined,
    params.stationIds && params.stationIds.length > 0
      ? expandIndexed("station_ids", params.stationIds)
      : undefined,
    params.states && params.states.length > 0
      ? expandIndexed("state", params.states)
      : undefined,
    params.genusIds && params.genusIds.length > 0
      ? expandIndexed("genus_id", params.genusIds)
      : undefined,
    params.familyIds && params.familyIds.length > 0
      ? expandIndexed("family_id", params.familyIds)
      : undefined,
    params.orderIds && params.orderIds.length > 0
      ? expandIndexed("order_id", params.orderIds)
      : undefined,
    params.classIds && params.classIds.length > 0
      ? expandIndexed("class_id", params.classIds)
      : undefined,
    params.phenophaseIds && params.phenophaseIds.length > 0
      ? expandIndexed("phenophase_id", params.phenophaseIds)
      : undefined,
    params.coords
      ? expandIndexed("coords", params.coords as unknown as number[])
      : undefined,
  ]);

  const fetchOpts: NpnFetchOptions = { rawQuery };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;
  const result = await npnFetch(
    "/observations/getObservations.json",
    ObservationListSchema,
    fetchOpts,
  );
  if (!result.ok) return result;
  return ok(result.data.map(normalizeObservation));
}

function guardObservationsParams(
  params: GetObservationsParams,
): Result<true> {
  if (!Array.isArray(params.years) || params.years.length === 0) {
    return err({
      source: "npn",
      message: "getObservations: years[] must be non-empty",
    });
  }
  for (const y of params.years) {
    if (!Number.isInteger(y) || y < 2009 || y > 9999) {
      return err({
        source: "npn",
        message: `getObservations: invalid year ${y} (NPN data starts in 2009)`,
      });
    }
  }
  const hasNarrowing =
    (params.speciesIds && params.speciesIds.length > 0) ||
    (params.stationIds && params.stationIds.length > 0) ||
    (params.states && params.states.length > 0) ||
    (params.genusIds && params.genusIds.length > 0) ||
    (params.familyIds && params.familyIds.length > 0) ||
    (params.orderIds && params.orderIds.length > 0) ||
    (params.classIds && params.classIds.length > 0);
  if (!hasNarrowing) {
    return err({
      source: "npn",
      message:
        "getObservations: at least one of speciesIds, stationIds, states, genusIds, familyIds, orderIds, classIds must be provided. Unfiltered queries can return tens of MB.",
    });
  }
  return ok(true);
}

// ----------------------------------------------------------------------------
// 7. getSiteLevelData, site-level phenometrics
// ----------------------------------------------------------------------------

export interface GetSiteLevelDataParams {
  /**
   * Date window (YYYY-MM-DD). NPN made `start_date`/`end_date` REQUIRED on
   * getSiteLevelData around 2026-05; without them the endpoint returns
   * HTTP 400 `{"error":"start_date and end_date are required"}`. Prefer these.
   */
  startDate?: string;
  endDate?: string;
  /**
   * @deprecated NPN silently ignores `years[]` on getSiteLevelData since the
   * ~2026-05 contract change. Retained as a fallback: when `startDate`/`endDate`
   * are absent, a window of [min(years)-01-01, max(years)-12-31] is derived so
   * pre-existing callers keep working. Prefer startDate/endDate.
   */
  years?: number[];
  speciesIds?: number[];
  stationIds?: number[];
  /**
   * NOTE: as of 2026-07 NPN silently IGNORES the `state[]` filter on this
   * endpoint (it returns rows for all states). `speciesIds` and `stationIds`
   * filter correctly. Left in place for when/if upstream restores it.
   */
  states?: string[];
  phenophaseIds?: number[];
  /** Override the default 60s fetch timeout. Wide-window queries can take 50–60s. */
  timeoutMs?: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve the NPN-required date window for getSiteLevelData. Prefers explicit
 * `startDate`/`endDate`; otherwise derives a calendar-year span from the legacy
 * (now upstream-ignored) `years[]` so older callers still work.
 */
function resolveSiteLevelWindow(params: GetSiteLevelDataParams): Result<{
  startDate: string;
  endDate: string;
}> {
  const { startDate, endDate, years } = params;
  if (startDate !== undefined || endDate !== undefined) {
    if (!startDate || !endDate) {
      return err({
        source: "npn",
        message:
          "getSiteLevelData: startDate and endDate must be provided together (YYYY-MM-DD)",
      });
    }
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      return err({
        source: "npn",
        message: `getSiteLevelData: startDate/endDate must be YYYY-MM-DD, got "${startDate}".."${endDate}"`,
      });
    }
    if (startDate > endDate) {
      return err({
        source: "npn",
        message: `getSiteLevelData: startDate ${startDate} is after endDate ${endDate}`,
      });
    }
    return ok({ startDate, endDate });
  }
  if (Array.isArray(years) && years.length > 0) {
    for (const y of years) {
      if (!Number.isInteger(y) || y < 2009 || y > 9999) {
        return err({
          source: "npn",
          message: `getSiteLevelData: invalid year ${y} (NPN data starts in 2009)`,
        });
      }
    }
    const min = Math.min(...years);
    const max = Math.max(...years);
    return ok({ startDate: `${min}-01-01`, endDate: `${max}-12-31` });
  }
  return err({
    source: "npn",
    message:
      "getSiteLevelData: a date window is required. Pass startDate+endDate (YYYY-MM-DD), or years[] to derive one. NPN requires start_date/end_date since ~2026-05.",
  });
}

export async function getSiteLevelData(
  params: GetSiteLevelDataParams,
): Promise<Result<NormalizedSiteLevelData[]>> {
  const windowRes = resolveSiteLevelWindow(params);
  if (!windowRes.ok) return windowRes;
  const { startDate, endDate } = windowRes.data;

  const hasNarrowing =
    (params.speciesIds && params.speciesIds.length > 0) ||
    (params.stationIds && params.stationIds.length > 0) ||
    (params.states && params.states.length > 0);
  if (!hasNarrowing) {
    return err({
      source: "npn",
      message:
        "getSiteLevelData: at least one of speciesIds, stationIds, or states must be provided",
    });
  }

  // getSiteLevelData uses `station_id` (singular) for the station filter,
  // unlike getObservations which uses `station_ids` (plural). NPN inconsistency.
  // `years[]` is no longer sent; it is ignored upstream and the date window
  // now drives the temporal filter.
  const rawQuery = joinRawQuery([
    params.speciesIds && params.speciesIds.length > 0
      ? expandIndexed("species_id", params.speciesIds)
      : undefined,
    params.stationIds && params.stationIds.length > 0
      ? expandIndexed("station_id", params.stationIds)
      : undefined,
    params.states && params.states.length > 0
      ? expandIndexed("state", params.states)
      : undefined,
    params.phenophaseIds && params.phenophaseIds.length > 0
      ? expandIndexed("phenophase_id", params.phenophaseIds)
      : undefined,
  ]);

  const fetchOpts: NpnFetchOptions = {
    searchParams: { start_date: startDate, end_date: endDate },
    rawQuery,
  };
  if (params.timeoutMs !== undefined) fetchOpts.timeoutMs = params.timeoutMs;
  const result = await npnFetch(
    "/observations/getSiteLevelData.json",
    SiteLevelDataListSchema,
    fetchOpts,
  );
  if (!result.ok) return result;
  return ok(result.data.map(normalizeSiteLevelData));
}

// ----------------------------------------------------------------------------
// Composed helper, getActivePhenologyNearby
// ----------------------------------------------------------------------------

export interface GetActivePhenologyNearbyParams {
  coords: Coordinates;
  radiusKm: number;
  /**
   * Rolling look-back window in days, ending today. Default 365. NPN citizen-
   * science density is sparse and lags by weeks at many sites, so narrow
   * windows (< ~90 days) frequently return nothing; a 365-day window reliably
   * yields data while the most-recent sort surfaces the freshest phenophase.
   */
  windowDays?: number;
  /**
   * @deprecated Use `windowDays`. Retained for compatibility: when `windowDays`
   * is absent, `yearsBack` maps to `yearsBack * 365` days.
   */
  yearsBack?: number;
  /** Cap on stations queried. NPN's URL limit caps us at ~50; default 40. */
  maxStations?: number;
}

export interface ActivePhenologyEntry extends NormalizedSiteLevelData {
  distanceKm: number;
}

export interface ActivePhenologyResult {
  coordinates: Coordinates;
  radiusKm: number;
  /** The rolling look-back window used, in days. */
  windowDays: number;
  /** @deprecated Derived as round(windowDays / 365). Retained for compatibility. */
  yearsBack: number;
  /** Stations within the haversine radius. */
  stationsInRadius: number;
  /** Stations actually queried, capped at `maxStations`, closest first. */
  stationsSearched: number;
  /** Site-level phenometric rows within radius, sorted by most-recent meanLastYesDate. */
  entries: ActivePhenologyEntry[];
}

const DEFAULT_WINDOW_DAYS = 365;
const DAY_MS = 86_400_000;
const DEFAULT_MAX_STATIONS = 40;

/**
 * "What phenology has been recorded near these coordinates recently?"
 *
 * NPN's getObservations endpoint is bulk-download (a single station-year can
 * be 80+ MB), so the helper instead composes:
 *   1. Build a WKT bounding box from coords + radius.
 *   2. Pull stations inside the polygon.
 *   3. Filter stations by haversine distance.
 *   4. Call getSiteLevelData({stationIds, startDate, endDate}), the per-site
 *      phenometric summary, which is bandwidth-friendly (mean first/last "yes"
 *      dates per species + phenophase).
 *   5. Sort by most-recent meanLastYesDate; attach distance to each entry.
 *
 * This is the closest "what's blooming near me" answer NPN's API supports
 * without downloading raw observations.
 */
export async function getActivePhenologyNearby(
  params: GetActivePhenologyNearbyParams,
): Promise<Result<ActivePhenologyResult>> {
  if (
    !Number.isFinite(params.coords.lat) ||
    !Number.isFinite(params.coords.lng)
  ) {
    return err({
      source: "npn",
      message: "getActivePhenologyNearby: coords must be finite numbers",
    });
  }
  if (!Number.isFinite(params.radiusKm) || params.radiusKm <= 0) {
    return err({
      source: "npn",
      message: "getActivePhenologyNearby: radiusKm must be positive",
    });
  }
  const windowDays =
    params.windowDays ??
    (params.yearsBack !== undefined
      ? params.yearsBack * 365
      : DEFAULT_WINDOW_DAYS);
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 20 * 365) {
    return err({
      source: "npn",
      message:
        "getActivePhenologyNearby: windowDays must be an integer in 1..7300 (yearsBack, if used, in 1..20)",
    });
  }
  const yearsBack = Math.max(1, Math.round(windowDays / 365));
  const maxStations = params.maxStations ?? DEFAULT_MAX_STATIONS;
  if (!Number.isInteger(maxStations) || maxStations < 1 || maxStations > 50) {
    return err({
      source: "npn",
      message:
        "getActivePhenologyNearby: maxStations must be an integer in 1..50 (NPN URL limit)",
    });
  }

  const wkt = bboxWkt(params.coords, params.radiusKm);
  const stationsRes = await getStationsByLocation({ wkt });
  if (!stationsRes.ok) return stationsRes;

  const inRadius = stationsRes.data
    .map((s) => ({
      station: s,
      distanceKm: haversineKm(params.coords, s.coordinates),
    }))
    .filter((row) => row.distanceKm <= params.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (inRadius.length === 0) {
    return ok({
      coordinates: params.coords,
      radiusKm: params.radiusKm,
      windowDays,
      yearsBack,
      stationsInRadius: 0,
      stationsSearched: 0,
      entries: [],
    });
  }

  // Take the closest N to stay under NPN's URL length limit.
  const queryStations = inRadius.slice(0, maxStations);
  const stationIds = queryStations.map((r) => Number(r.station.id));
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - windowDays * DAY_MS)
    .toISOString()
    .slice(0, 10);

  const slRes = await getSiteLevelData({
    stationIds,
    startDate,
    endDate,
    timeoutMs: 90_000,
  });
  if (!slRes.ok) return slRes;

  const stationToDistance = new Map<number, number>();
  for (const row of queryStations) {
    stationToDistance.set(Number(row.station.id), row.distanceKm);
  }

  const entries: ActivePhenologyEntry[] = slRes.data.map((d) => ({
    ...d,
    // siteId in getSiteLevelData rows is the station_id we queried with.
    distanceKm: stationToDistance.get(d.siteId) ?? Number.POSITIVE_INFINITY,
  }));

  entries.sort((a, b) => {
    const aJd = a.meanLastYesJulian ?? -Infinity;
    const bJd = b.meanLastYesJulian ?? -Infinity;
    if (aJd !== bJd) return bJd - aJd;
    return a.distanceKm - b.distanceKm;
  });

  return ok({
    coordinates: params.coords,
    radiusKm: params.radiusKm,
    windowDays,
    yearsBack,
    stationsInRadius: inRadius.length,
    stationsSearched: queryStations.length,
    entries,
  });
}
