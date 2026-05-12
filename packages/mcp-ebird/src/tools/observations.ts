import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getHistoricOnDate,
  getNearbyNotable,
  getNearbyOfSpecies,
  getNearbyRecent,
  getRecentNotable,
  getRecentObservations,
  getRecentOfSpecies,
} from "@pondlog/source-ebird";
import { z } from "zod";
import { failure, success } from "../respond.js";
import {
  backField,
  cmpField,
  dayField,
  detailField,
  distField,
  hotspotOnlyField,
  includeProvisionalField,
  latField,
  lngField,
  locIdField,
  maxResultsField,
  monthField,
  REGION_CODE_HELP,
  regionCodeField,
  sortField,
  speciesCodeField,
  sppLocaleField,
  yearField,
} from "../schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

function toRArray(r: string | string[] | undefined): string | string[] | undefined {
  return r;
}

const restrictToLocs = z
  .union([locIdField, z.array(locIdField).min(1)])
  .describe(
    "Restrict to specific eBird locIds (single or array). When set, results are filtered to these locations. Useful when you already know the locId of a hotspot from `get_hotspots_in_region`.",
  );

export function registerObservationTools(server: McpServer): void {
  server.registerTool(
    "get_recent_observations",
    {
      title: "Recent Bird Observations in a Region",
      description:
        `Returns the most recent observation of each species seen in an eBird region in the last \`back\` days. Each row is one species (eBird deduplicates server-side: most recent sighting per species). Each row includes species code, common + scientific name, location, observer, count, and date. ${REGION_CODE_HELP} ` +
        "Use this for region-scoped queries ('what birds have been seen in Clallam County this week?'). For coords-scoped queries, use `get_nearby_recent` instead. For unusual sightings only, use `get_recent_notable`.",
      inputSchema: {
        region_code: regionCodeField,
        back: backField.optional(),
        cat: cmpField.optional(),
        hotspot: hotspotOnlyField.optional(),
        include_provisional: includeProvisionalField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000. Default returns all matching."),
        r: restrictToLocs.optional(),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getRecentObservations(args.region_code, {
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.cat ? { cat: args.cat } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.include_provisional !== undefined
          ? { includeProvisional: args.include_provisional }
          : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.r ? { r: toRArray(args.r) } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_recent_notable",
    {
      title: "Recent Notable / Rare Sightings in a Region",
      description:
        `Returns recent notable (rare or out-of-range) bird sightings in an eBird region. \"Notable\" is determined by eBird reviewers using regional rarity filters, a Mountain Bluebird in coastal Washington might be notable; a Crow is not. ${REGION_CODE_HELP} ` +
        "Use this when the caller asks for unusual / rare / interesting sightings. For all recent species (not just notable), use `get_recent_observations`.",
      inputSchema: {
        region_code: regionCodeField,
        back: backField.optional(),
        detail: detailField.optional(),
        hotspot: hotspotOnlyField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        r: restrictToLocs.optional(),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getRecentNotable(args.region_code, {
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.detail ? { detail: args.detail } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.r ? { r: toRArray(args.r) } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_recent_of_species",
    {
      title: "Recent Sightings of a Specific Species in a Region",
      description:
        `Returns recent sightings of one species in an eBird region. ${REGION_CODE_HELP} Returns each individual sighting (not deduplicated like \`get_recent_observations\`), including count, location, observer, and date. ` +
        "Use when the caller names a specific species and wants every recent sighting in a region. For coords-scoped, use `get_nearby_of_species`.",
      inputSchema: {
        region_code: regionCodeField,
        species_code: speciesCodeField,
        back: backField.optional(),
        hotspot: hotspotOnlyField.optional(),
        include_provisional: includeProvisionalField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        r: restrictToLocs.optional(),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getRecentOfSpecies(args.region_code, args.species_code, {
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.include_provisional !== undefined
          ? { includeProvisional: args.include_provisional }
          : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.r ? { r: toRArray(args.r) } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_nearby_recent",
    {
      title: "Recent Bird Observations Near Coordinates",
      description:
        "Returns the most recent observation of each species within `dist` km of a lat/lng over the last `back` days. eBird deduplicates server-side (one row per species, most recent). " +
        "Use for coords-scoped 'what's been seen near me' queries. For region-scoped, use `get_recent_observations`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        dist: distField.optional(),
        back: backField.optional(),
        cat: cmpField.optional(),
        hotspot: hotspotOnlyField.optional(),
        include_provisional: includeProvisionalField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        sort: sortField.optional(),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getNearbyRecent(args.lat, args.lng, {
        ...(args.dist !== undefined ? { dist: args.dist } : {}),
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.cat ? { cat: args.cat } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.include_provisional !== undefined
          ? { includeProvisional: args.include_provisional }
          : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.sort ? { sort: args.sort } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_nearby_notable",
    {
      title: "Recent Notable / Rare Sightings Near Coordinates",
      description:
        "Returns notable (rare/unusual) sightings within `dist` km of a lat/lng over the last `back` days. \"Notable\" is determined by eBird reviewers using regional rarity filters. " +
        "Use for hyper-local rare-bird alerts. For region-scoped notables, use `get_recent_notable`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        dist: distField.optional(),
        back: backField.optional(),
        detail: detailField.optional(),
        hotspot: hotspotOnlyField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getNearbyNotable(args.lat, args.lng, {
        ...(args.dist !== undefined ? { dist: args.dist } : {}),
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.detail ? { detail: args.detail } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_nearby_of_species",
    {
      title: "Recent Sightings of a Species Near Coordinates",
      description:
        "Returns recent sightings of one species within `dist` km of a lat/lng. Each row is an individual sighting (not deduplicated). " +
        "Use when the caller names a species and wants nearby sightings. For region-scoped, use `get_recent_of_species`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        species_code: speciesCodeField,
        dist: distField.optional(),
        back: backField.optional(),
        hotspot: hotspotOnlyField.optional(),
        include_provisional: includeProvisionalField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getNearbyOfSpecies(args.lat, args.lng, args.species_code, {
        ...(args.dist !== undefined ? { dist: args.dist } : {}),
        ...(args.back !== undefined ? { back: args.back } : {}),
        ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
        ...(args.include_provisional !== undefined
          ? { includeProvisional: args.include_provisional }
          : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
        ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_historic_on_date",
    {
      title: "Bird Observations on a Specific Date in a Region",
      description:
        `Returns observations recorded in an eBird region on a specific calendar date. ${REGION_CODE_HELP} Note: state-level historic queries can return thousands of rows and be slow, prefer county scope (subnational2) for narrower results.`,
      inputSchema: {
        region_code: regionCodeField,
        year: yearField,
        month: monthField,
        day: dayField,
        cat: cmpField.optional(),
        detail: detailField.optional(),
        hotspot: hotspotOnlyField.optional(),
        include_provisional: includeProvisionalField.optional(),
        max_results: maxResultsField
          .max(10000)
          .optional()
          .describe("Max results, 1-10000."),
        r: restrictToLocs.optional(),
        rank: z
          .enum(["mrec", "create"])
          .optional()
          .describe(
            "Which observation per species: \"mrec\" (most recent on the day, default), or \"create\" (first submitted).",
          ),
        spp_locale: sppLocaleField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getHistoricOnDate(
        args.region_code,
        args.year,
        args.month,
        args.day,
        {
          ...(args.cat ? { cat: args.cat } : {}),
          ...(args.detail ? { detail: args.detail } : {}),
          ...(args.hotspot !== undefined ? { hotspot: args.hotspot } : {}),
          ...(args.include_provisional !== undefined
            ? { includeProvisional: args.include_provisional }
            : {}),
          ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
          ...(args.r ? { r: toRArray(args.r) } : {}),
          ...(args.rank ? { rank: args.rank } : {}),
          ...(args.spp_locale ? { sppLocale: args.spp_locale } : {}),
        },
      );
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
