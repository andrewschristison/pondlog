import {
  getTidePredictions,
  splitHighLow,
  type Coordinates,
  type NatureBriefing,
  type NightSkyBriefing,
  type Observation,
  type PhenologyEntry,
  type Result,
  type StreamflowReading,
} from "@pondlog/core";
import { getNearbyRecentNormalized } from "@pondlog/source-ebird";
import { getNearbyObservations } from "@pondlog/source-inaturalist";
import {
  getActivePhenologyNearby,
  type NormalizedSiteLevelData,
} from "@pondlog/source-npn";
import { getTonightsBriefing } from "@pondlog/source-nightsky";
import {
  getInstantaneousValues,
  type NormalizedUsgsReading,
} from "@pondlog/source-usgs";
import { withCache } from "./cache.js";
import type { PondlogConfig } from "./config.js";

const DEFAULT_INAT_RADIUS_KM = 25;
const DEFAULT_INAT_DAYS = 7;
const DEFAULT_EBIRD_DIST_KM = 25;
const DEFAULT_EBIRD_BACK = 7;
const DEFAULT_NPN_RADIUS_KM = 50;
const DEFAULT_NPN_YEARS_BACK = 2;

export interface BuildTodayBriefingParams {
  coords: Coordinates;
  date?: Date;
  config: PondlogConfig | null;
  /** When true, skip the on-disk cache. */
  noCache?: boolean;
}

export interface BuildTodayBriefingResult {
  briefing: NatureBriefing;
  /** Per-source diagnostic flags so the renderer can show "(cached)" hints. */
  cacheHits: Record<string, boolean>;
}

/**
 * Build the unified "what's happening at these coordinates" briefing.
 *
 * All six sources fan out in parallel via `Promise.allSettled`. A failed source
 * adds an entry to `errors[]` but never crashes the briefing. The night-sky
 * source is pure local computation and is treated as required (its absence
 * means we can't even populate the legacy `celestial` field — but it should
 * be effectively infallible for valid coordinates).
 */
export async function buildTodayBriefing(
  params: BuildTodayBriefingParams,
): Promise<BuildTodayBriefingResult> {
  const errors: { source: string; message: string }[] = [];
  const cacheHits: Record<string, boolean> = {};
  const noCache = params.noCache === true;
  const date = params.date ?? new Date();

  const inatPromise = withCache({
    source: "inaturalist",
    params: { fn: "nearby", coords: params.coords, radiusKm: DEFAULT_INAT_RADIUS_KM, days: DEFAULT_INAT_DAYS },
    bypass: noCache,
    fetcher: () => getNearbyObservations(params.coords, DEFAULT_INAT_RADIUS_KM, DEFAULT_INAT_DAYS),
  });

  const ebirdPromise = withCache({
    source: "ebird",
    params: { fn: "nearby", coords: params.coords, dist: DEFAULT_EBIRD_DIST_KM, back: DEFAULT_EBIRD_BACK },
    bypass: noCache,
    fetcher: () =>
      getNearbyRecentNormalized(params.coords.lat, params.coords.lng, {
        dist: DEFAULT_EBIRD_DIST_KM,
        back: DEFAULT_EBIRD_BACK,
      }),
  });

  const npnPromise = withCache({
    source: "npn",
    params: { fn: "active", coords: params.coords, radiusKm: DEFAULT_NPN_RADIUS_KM, yearsBack: DEFAULT_NPN_YEARS_BACK },
    bypass: noCache,
    fetcher: () =>
      getActivePhenologyNearby({
        coords: params.coords,
        radiusKm: DEFAULT_NPN_RADIUS_KM,
        yearsBack: DEFAULT_NPN_YEARS_BACK,
      }),
  });

  const usgsSite = params.config?.usgsSite;
  const usgsPromise: Promise<{ result: Result<NormalizedUsgsReading[]>; cacheHit: boolean } | null> =
    usgsSite
      ? withCache({
          source: "usgs",
          params: { fn: "iv", site: usgsSite, parameterCodes: ["00060", "00065"], period: "PT2H" },
          bypass: noCache,
          fetcher: () =>
            getInstantaneousValues({
              sites: [usgsSite],
              parameterCodes: ["00060", "00065"],
              period: "PT2H",
            }),
        })
      : Promise.resolve(null);

  const noaaStation = params.config?.noaaStation;
  const noaaPromise = noaaStation
    ? withCache({
        source: "noaa",
        params: { fn: "tides", stationId: noaaStation, date: isoDate(date) },
        bypass: noCache,
        fetcher: () => getTidePredictions({ stationId: noaaStation, date: isoDate(date) }),
      })
    : Promise.resolve(null);

  const nightSkyResult = getTonightsBriefing({ coords: params.coords, date });

  const [inatRes, ebirdRes, npnRes, usgsRes, noaaRes] = await Promise.all([
    inatPromise.catch(captureSettled("inaturalist")),
    ebirdPromise.catch(captureSettled("ebird")),
    npnPromise.catch(captureSettled("npn")),
    usgsPromise.catch(captureSettled("usgs")),
    noaaPromise.catch(captureSettled("noaa")),
  ]);

  const recentObservations: Observation[] = [];
  ingest(inatRes, "inaturalist", errors, cacheHits, (data) => {
    recentObservations.push(...data);
  });
  ingest(ebirdRes, "ebird", errors, cacheHits, (data) => {
    recentObservations.push(...data);
  });
  recentObservations.sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? ""));

  let phenology: PhenologyEntry[] | undefined;
  ingest(npnRes, "npn", errors, cacheHits, (data) => {
    phenology = data.entries.map(toPhenologyEntry).filter(Boolean) as PhenologyEntry[];
  });

  let streamflow: StreamflowReading | undefined;
  if (usgsRes) {
    ingest(usgsRes, "usgs", errors, cacheHits, (readings) => {
      const reading = readings[0];
      if (reading) streamflow = readingToStreamflow(reading);
    });
  } else if (params.config?.usgsSite === undefined) {
    // No site configured — silent skip (user can `pondlog config set-usgs-site`).
  }

  let tides: { high: import("@pondlog/core").TideEvent[]; low: import("@pondlog/core").TideEvent[] } | undefined;
  if (noaaRes) {
    ingest(noaaRes, "noaa", errors, cacheHits, (data) => {
      tides = splitHighLow(data);
    });
  }

  let nightSky: NightSkyBriefing | undefined;
  if (nightSkyResult.ok) {
    nightSky = nightSkyResult.data;
  } else {
    errors.push({ source: "nightsky", message: nightSkyResult.error.message });
  }

  const briefing: NatureBriefing = {
    coordinates: params.coords,
    generatedAt: new Date().toISOString(),
    celestial: deriveLegacyCelestial(nightSky),
    ...(nightSky ? { nightSky } : {}),
    ...(tides ? { tides } : {}),
    recentObservations,
    speciesCounts: [],
    ...(streamflow ? { streamflow } : {}),
    ...(phenology ? { phenology } : {}),
    errors,
  };

  return { briefing, cacheHits };
}

function ingest<T>(
  payload: { result: Result<T>; cacheHit: boolean } | null,
  source: string,
  errors: { source: string; message: string }[],
  cacheHits: Record<string, boolean>,
  onSuccess: (data: T) => void,
): void {
  if (payload === null) return;
  cacheHits[source] = payload.cacheHit;
  if (payload.result.ok) {
    onSuccess(payload.result.data);
  } else {
    errors.push({ source, message: payload.result.error.message });
  }
}

function captureSettled(source: string) {
  return (
    cause: unknown,
  ): { result: Result<never>; cacheHit: boolean } => ({
    result: {
      ok: false,
      error: {
        source,
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      },
    },
    cacheHit: false,
  });
}

function deriveLegacyCelestial(
  nightSky: NightSkyBriefing | undefined,
): NatureBriefing["celestial"] {
  if (!nightSky) {
    return {
      sunrise: null,
      sunset: null,
      daylightHours: 0,
      moonPhase: "Unknown",
      moonIllumination: 0,
    };
  }
  const sunrise = nightSky.sun.sunrise;
  const sunset = nightSky.sun.sunset;
  const daylight =
    sunrise && sunset
      ? Math.max(
          0,
          (new Date(sunset).getTime() - new Date(sunrise).getTime()) /
            3_600_000,
        )
      : 0;
  return {
    sunrise,
    sunset,
    daylightHours: Math.round(daylight * 100) / 100,
    moonPhase: nightSky.moon.phase,
    moonIllumination:
      Math.round(nightSky.moon.illuminationFraction * 1000) / 1000,
  };
}

function readingToStreamflow(reading: NormalizedUsgsReading): StreamflowReading {
  const flowSeries = reading.series.find((s) => s.parameterCode === "00060");
  const heightSeries = reading.series.find((s) => s.parameterCode === "00065");
  const latestFlow = lastValue(flowSeries?.values);
  const latestHeight = lastValue(heightSeries?.values);
  const out: StreamflowReading = {
    siteId: reading.site.siteNumber,
    siteName: reading.site.siteName,
  };
  if (latestFlow !== undefined) out.flowCfs = latestFlow.value;
  if (latestHeight !== undefined) out.gageHeightFt = latestHeight.value;
  if (latestFlow?.dateTime) out.observedAt = latestFlow.dateTime;
  else if (latestHeight?.dateTime) out.observedAt = latestHeight.dateTime;
  return out;
}

function lastValue(
  values:
    | { value: number | undefined; dateTime: string }[]
    | undefined,
): { value: number; dateTime: string } | undefined {
  if (!values || values.length === 0) return undefined;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v && typeof v.value === "number" && Number.isFinite(v.value)) {
      return { value: v.value, dateTime: v.dateTime };
    }
  }
  return undefined;
}

function toPhenologyEntry(
  row: NormalizedSiteLevelData & { distanceKm: number },
): PhenologyEntry | null {
  if (!row.commonName && !row.taxonName) return null;
  const entry: PhenologyEntry = {
    species: row.commonName || row.taxonName,
    phenophase: row.phenophaseDescription ?? "active",
    distanceKm: Math.round(row.distanceKm * 10) / 10,
  };
  if (row.meanLastYesDate) {
    const ms = new Date(row.meanLastYesDate).getTime();
    if (Number.isFinite(ms)) {
      const days = Math.floor((Date.now() - ms) / 86_400_000);
      if (days >= 0) entry.daysSinceLastYes = days;
    }
  }
  return entry;
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
