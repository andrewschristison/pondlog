import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  err,
  getTidePredictions,
  splitHighLow,
  type Coordinates,
  type Observation,
  type Result,
  type TideEvent,
} from "@pondlog/core";
import { getNearbyRecentNormalized } from "@pondlog/source-ebird";
import { getNearbyObservations } from "@pondlog/source-inaturalist";
import { getActivePhenologyNearby } from "@pondlog/source-npn";
import { getTonightsBriefing } from "@pondlog/source-nightsky";
import {
  getInstantaneousValues,
  type NormalizedUsgsReading,
} from "@pondlog/source-usgs";
import { buildBriefing, withEbirdApiKey } from "./briefing.js";
import { failure, success } from "./respond.js";
import {
  daysField,
  dateField,
  ebirdApiKeyField,
  latField,
  lngField,
  mushroomObserverRegionField,
  noaaStationField,
  radiusField,
  usgsSiteField,
  yearsBackField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerGetNatureBriefing(server);
  registerGetNearbyWildlife(server);
  registerGetWaterConditions(server);
  registerGetTonightSky(server);
  registerGetPhenology(server);
}

function registerGetNatureBriefing(server: McpServer): void {
  server.registerTool(
    "get_nature_briefing",
    {
      title: "Place-Aware Nature Briefing",
      description:
        "Returns a complete nature briefing for a location, birds, wildlife, fungi, plants, tides, streamflow, night sky, and phenology stitched from seven data sources (iNaturalist, eBird, Mushroom Observer, NOAA, USGS, NPN, astronomy-engine) into one response. " +
        "All seven sources are fetched in parallel; partial failures are reported in the `errors` array without crashing the briefing. " +
        "This is the primary tool: one call replaces seven API integrations. For drilling into a single area, prefer the focused tools `get_nearby_wildlife`, `get_water_conditions`, `get_tonight_sky`, or `get_phenology`. " +
        "Tides require a NOAA station id; streamflow requires a USGS site number, pass them in or set NOAA_STATION / USGS_SITE env vars. eBird requires a free API key (EBIRD_API_KEY env var or `ebird_api_key` input). Mushroom Observer needs no key.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        date: dateField.optional(),
        noaa_station: noaaStationField.optional(),
        usgs_site: usgsSiteField.optional(),
        ebird_api_key: ebirdApiKeyField.optional(),
        mushroom_observer_region: mushroomObserverRegionField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const date = parseDate(args.date);
      const noaaStation = args.noaa_station ?? process.env.NOAA_STATION;
      const usgsSite = args.usgs_site ?? process.env.USGS_SITE;
      const moRegion =
        args.mushroom_observer_region ?? process.env.MUSHROOM_OBSERVER_REGION;
      const briefing = await withEbirdApiKey(args.ebird_api_key, () =>
        buildBriefing({
          coords: { lat: args.lat, lng: args.lng },
          ...(date ? { date } : {}),
          ...(noaaStation ? { noaaStation } : {}),
          ...(usgsSite ? { usgsSite } : {}),
          ...(moRegion ? { mushroomObserverRegion: moRegion } : {}),
        }),
      );
      return success(briefing);
    },
  );
}

function registerGetNearbyWildlife(server: McpServer): void {
  server.registerTool(
    "get_nearby_wildlife",
    {
      title: "Nearby Wildlife (iNaturalist + eBird)",
      description:
        "Combined feed of recent wildlife sightings near a location. Merges iNaturalist observations (all taxa, citizen-science) with eBird observations (birds, expert-curated) into one chronologically-sorted list. " +
        "Use this when the caller asks 'what's been seen near me' without specifying birds-only or invertebrates-only. For finer control (taxon filters, date ranges) use the per-source MCP servers (`@pondlog/mcp-inaturalist`, `@pondlog/mcp-ebird`). " +
        "eBird requires a free API key (EBIRD_API_KEY env var or `ebird_api_key` input). Without it, only the iNaturalist half populates and an `ebird` entry appears in `errors[]`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField.optional().describe("Default 25 km."),
        days: daysField.optional().describe("Default 7 days."),
        ebird_api_key: ebirdApiKeyField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const coords: Coordinates = { lat: args.lat, lng: args.lng };
      const radiusKm = args.radius_km ?? 25;
      const days = args.days ?? 7;

      const [inatRes, ebirdRes] = await withEbirdApiKey(
        args.ebird_api_key,
        async () => {
          const inatPromise = getNearbyObservations(coords, radiusKm, days);
          const ebirdPromise = getNearbyRecentNormalized(
            coords.lat,
            coords.lng,
            { dist: radiusKm, back: days },
          );
          return Promise.all([
            inatPromise.catch(captureSettled<Observation[]>("inaturalist")),
            ebirdPromise.catch(captureSettled<Observation[]>("ebird")),
          ]);
        },
      );

      const observations: Observation[] = [];
      const errors: { source: string; message: string }[] = [];
      pushOrErr(inatRes, "inaturalist", errors, (data) => {
        observations.push(...data);
      });
      pushOrErr(ebirdRes, "ebird", errors, (data) => {
        observations.push(...data);
      });
      observations.sort((a, b) =>
        (b.observedAt ?? "").localeCompare(a.observedAt ?? ""),
      );

      return success({
        coordinates: coords,
        radiusKm,
        days,
        observations,
        errors,
      });
    },
  );
}

function registerGetWaterConditions(server: McpServer): void {
  server.registerTool(
    "get_water_conditions",
    {
      title: "Water Conditions (USGS Streamflow + NOAA Tides)",
      description:
        "Returns current streamflow (USGS instantaneous values: discharge cfs and gage height ft) plus tide predictions (NOAA CO-OPS, high/low for the date). " +
        "Both keys are always present in the response, `streamflow: null` when no USGS site is configured, `tides: null` when no NOAA station is configured. Failures populate `errors[]`. " +
        "Pass `noaa_station` and `usgs_site` per call, or set NOAA_STATION and USGS_SITE env vars at server startup. Neither requires an API key.",
      inputSchema: {
        date: dateField
          .optional()
          .describe("Date for tide predictions, YYYY-MM-DD. Defaults to today (UTC). USGS streamflow is always 'last 2 hours'."),
        noaa_station: noaaStationField.optional(),
        usgs_site: usgsSiteField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const date = parseDate(args.date) ?? new Date();
      const noaaStation = args.noaa_station ?? process.env.NOAA_STATION;
      const usgsSite = args.usgs_site ?? process.env.USGS_SITE;
      const errors: { source: string; message: string }[] = [];

      const usgsPromise: Promise<Result<NormalizedUsgsReading[]> | null> =
        usgsSite
          ? getInstantaneousValues({
              sites: [usgsSite],
              parameterCodes: ["00060", "00065"],
              period: "PT2H",
            })
          : Promise.resolve(null);

      const noaaPromise: Promise<Result<TideEvent[]> | null> = noaaStation
        ? getTidePredictions({ stationId: noaaStation, date: isoDate(date) })
        : Promise.resolve(null);

      const [usgsRes, noaaRes] = await Promise.all([
        usgsPromise.catch(captureSettled<NormalizedUsgsReading[]>("usgs")),
        noaaPromise.catch(captureSettled<TideEvent[]>("noaa")),
      ]);

      if (!usgsSite) {
        errors.push({
          source: "usgs",
          message:
            "no USGS site configured, pass `usgs_site` or set USGS_SITE env var",
        });
      }
      if (!noaaStation) {
        errors.push({
          source: "noaa",
          message:
            "no NOAA station configured, pass `noaa_station` or set NOAA_STATION env var",
        });
      }

      let streamflow: NormalizedUsgsReading | null = null;
      if (usgsRes) {
        if (usgsRes.ok) {
          streamflow = usgsRes.data[0] ?? null;
          if (streamflow === null) {
            errors.push({
              source: "usgs",
              message: `no readings returned for site ${usgsSite}`,
            });
          }
        } else {
          errors.push({ source: "usgs", message: usgsRes.error.message });
        }
      }

      let tides: { high: TideEvent[]; low: TideEvent[] } | null = null;
      if (noaaRes) {
        if (noaaRes.ok) {
          tides = splitHighLow(noaaRes.data);
        } else {
          errors.push({ source: "noaa", message: noaaRes.error.message });
        }
      }

      return success({
        date: isoDate(date),
        streamflow,
        tides,
        errors,
      });
    },
  );
}

function registerGetTonightSky(server: McpServer): void {
  server.registerTool(
    "get_tonight_sky",
    {
      title: "Tonight's Sky (Sun, Moon, Planets, Meteors, Constellations)",
      description:
        "Returns a full night-sky briefing for a location: sun times (sunrise/sunset/civil/nautical/astronomical twilight, golden hour), moon phase + illumination + rise/set, dark-sky window with 1-5 quality score, currently-visible planets with magnitude and compass direction, active and upcoming meteor showers, and top visible constellations. " +
        "Pure local computation via astronomy-engine, no network call, no API key, never rate-limited. Always works for valid coordinates.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        date: dateField.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false } as const,
    },
    async (args) => {
      const date = parseDate(args.date);
      const result = getTonightsBriefing({
        coords: { lat: args.lat, lng: args.lng },
        ...(date ? { date } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetPhenology(server: McpServer): void {
  server.registerTool(
    "get_phenology",
    {
      title: "Active Phenology Nearby (USA-NPN)",
      description:
        "Returns USA-NPN site-level phenometric records near a location: which species/phenophases (e.g. 'Flowers or flower buds', 'Open flowers', 'Ripe fruits') have been recorded at NPN stations within radius, with mean first/last 'yes' dates and distance. " +
        "Useful for 'what's blooming near me' or 'what's leafing out'. Coverage is best in the continental US. NPN's bulk-download endpoint is intentionally not exposed, this composes a station search + site-level query for a polite, bandwidth-friendly answer. No API key required.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField
          .optional()
          .describe("Default 50 km. Bigger radius pulls more stations into the query."),
        years_back: yearsBackField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getActivePhenologyNearby({
        coords: { lat: args.lat, lng: args.lng },
        radiusKm: args.radius_km ?? 50,
        ...(args.years_back !== undefined ? { yearsBack: args.years_back } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// helpers

function parseDate(s: string | undefined): Date | undefined {
  if (s === undefined) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function captureSettled<T>(source: string) {
  return (cause: unknown): Result<T> =>
    err({
      source,
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
}

function pushOrErr<T>(
  res: Result<T>,
  source: string,
  errors: { source: string; message: string }[],
  onSuccess: (data: T) => void,
): void {
  if (res.ok) onSuccess(res.data);
  else errors.push({ source, message: res.error.message });
}
