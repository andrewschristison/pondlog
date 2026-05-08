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
  type TideEvent,
} from "@pondlog/core";
import { getNearbyRecentNormalized } from "@pondlog/source-ebird";
import { getNearbyObservations } from "@pondlog/source-inaturalist";
import {
  getActivePhenologyNearby,
  type NormalizedSiteLevelData,
} from "@pondlog/source-npn";

type NpnPhenologyResult = Awaited<
  ReturnType<typeof getActivePhenologyNearby>
> extends Result<infer R>
  ? R
  : never;
import { getTonightsBriefing } from "@pondlog/source-nightsky";
import {
  getInstantaneousValues,
  type NormalizedUsgsReading,
} from "@pondlog/source-usgs";

const DEFAULT_INAT_RADIUS_KM = 25;
const DEFAULT_INAT_DAYS = 7;
const DEFAULT_EBIRD_DIST_KM = 25;
const DEFAULT_EBIRD_BACK = 7;
const DEFAULT_NPN_RADIUS_KM = 50;
const DEFAULT_NPN_YEARS_BACK = 2;

export interface BuildBriefingParams {
  coords: Coordinates;
  date?: Date;
  noaaStation?: string;
  usgsSite?: string;
}

/**
 * Build the unified "what's happening at these coordinates" briefing.
 *
 * All six sources fan out via Promise.allSettled. A failed source pushes onto
 * `errors[]` but never crashes the briefing. Night-sky is pure local
 * computation (effectively infallible for valid coordinates).
 *
 * No caching — each invocation fetches fresh. The MCP layer assumes the host
 * (Claude Desktop, Cursor, etc.) handles caching at its own layer if it wants
 * it; the CLI's disk cache is intentionally not reused here.
 */
export async function buildBriefing(
  params: BuildBriefingParams,
): Promise<NatureBriefing> {
  const errors: { source: string; message: string }[] = [];
  const date = params.date ?? new Date();

  const inatPromise = getNearbyObservations(
    params.coords,
    DEFAULT_INAT_RADIUS_KM,
    DEFAULT_INAT_DAYS,
  );

  const ebirdPromise = getNearbyRecentNormalized(
    params.coords.lat,
    params.coords.lng,
    { dist: DEFAULT_EBIRD_DIST_KM, back: DEFAULT_EBIRD_BACK },
  );

  const npnPromise = getActivePhenologyNearby({
    coords: params.coords,
    radiusKm: DEFAULT_NPN_RADIUS_KM,
    yearsBack: DEFAULT_NPN_YEARS_BACK,
  });

  const usgsPromise: Promise<Result<NormalizedUsgsReading[]> | null> =
    params.usgsSite
      ? getInstantaneousValues({
          sites: [params.usgsSite],
          parameterCodes: ["00060", "00065"],
          period: "PT2H",
        })
      : Promise.resolve(null);

  const noaaPromise: Promise<Result<TideEvent[]> | null> = params.noaaStation
    ? getTidePredictions({
        stationId: params.noaaStation,
        date: isoDate(date),
      })
    : Promise.resolve(null);

  const nightSkyResult = getTonightsBriefing({ coords: params.coords, date });

  const [inatRes, ebirdRes, npnRes, usgsRes, noaaRes] = await Promise.all([
    inatPromise.catch(captureSettled<Observation[]>("inaturalist")),
    ebirdPromise.catch(captureSettled<Observation[]>("ebird")),
    npnPromise.catch(captureSettled<NpnPhenologyResult>("npn")),
    usgsPromise.catch(captureSettled<NormalizedUsgsReading[]>("usgs")),
    noaaPromise.catch(captureSettled<TideEvent[]>("noaa")),
  ]);

  const recentObservations: Observation[] = [];
  ingest(inatRes, "inaturalist", errors, (data) => {
    recentObservations.push(...data);
  });
  ingest(ebirdRes, "ebird", errors, (data) => {
    recentObservations.push(...data);
  });
  recentObservations.sort((a, b) =>
    (b.observedAt ?? "").localeCompare(a.observedAt ?? ""),
  );

  let phenology: PhenologyEntry[] | undefined;
  ingest(npnRes, "npn", errors, (data) => {
    phenology = data.entries
      .map(toPhenologyEntry)
      .filter((e): e is PhenologyEntry => e !== null);
  });

  let streamflow: StreamflowReading | undefined;
  if (usgsRes) {
    ingest(usgsRes, "usgs", errors, (readings) => {
      const reading = readings[0];
      if (reading) streamflow = readingToStreamflow(reading);
    });
  }

  let tides: { high: TideEvent[]; low: TideEvent[] } | undefined;
  if (noaaRes) {
    ingest(noaaRes, "noaa", errors, (data) => {
      tides = splitHighLow(data);
    });
  }

  let nightSky: NightSkyBriefing | undefined;
  if (nightSkyResult.ok) {
    nightSky = nightSkyResult.data;
  } else {
    errors.push({ source: "nightsky", message: nightSkyResult.error.message });
  }

  return {
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
}

function ingest<T>(
  payload: Result<T> | null,
  source: string,
  errors: { source: string; message: string }[],
  onSuccess: (data: T) => void,
): void {
  if (payload === null) return;
  if (payload.ok) {
    onSuccess(payload.data);
  } else {
    errors.push({ source, message: payload.error.message });
  }
}

function captureSettled<T>(source: string) {
  return (cause: unknown): Result<T> => ({
    ok: false,
    error: {
      source,
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    },
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

function readingToStreamflow(
  reading: NormalizedUsgsReading,
): StreamflowReading {
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
  values: { value: number | undefined; dateTime: string }[] | undefined,
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

/**
 * Run `fn` with `process.env.EBIRD_API_KEY` set to `key` (when provided),
 * restoring the original value afterwards. Used so the `ebird_api_key` tool
 * input can override what the source-ebird client reads at fetch time.
 *
 * Caveat: stdio MCP servers handle JSON-RPC requests sequentially in
 * practice, but two overlapping handler invocations in the same process
 * could see interleaved env state. For shared deployments, prefer the
 * EBIRD_API_KEY env var path over the per-call input.
 */
export async function withEbirdApiKey<T>(
  key: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (key === undefined || key.trim() === "") return fn();
  const previous = process.env.EBIRD_API_KEY;
  process.env.EBIRD_API_KEY = key.trim();
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.EBIRD_API_KEY;
    } else {
      process.env.EBIRD_API_KEY = previous;
    }
  }
}
