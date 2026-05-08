import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getObservation,
  getRecentNearLocation,
  searchNames,
  searchObservations,
  searchRegions,
} from "@pondlog/source-mushroomobserver";
import { z } from "zod";
import { failure, success } from "./respond.js";
import {
  confidenceMinField,
  dateFromField,
  dateToField,
  daysField,
  hasImagesField,
  includeSubtaxaField,
  latField,
  limitField,
  lngField,
  maxPagesField,
  moNameQueryField,
  moRankField,
  observationIdField,
  pageField,
  radiusField,
  regionField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerSearchObservations(server);
  registerGetObservation(server);
  registerSearchFungalNames(server);
  registerSearchRegions(server);
  registerGetRecentFungi(server);
}

// ----------------------------------------------------------------------------
// search_observations
// ----------------------------------------------------------------------------

function registerSearchObservations(server: McpServer): void {
  server.registerTool(
    "search_observations",
    {
      title: "Search Mushroom Observer Observations",
      description:
        "Searches Mushroom Observer, the world's largest dedicated mycology platform with 500,000+ observations and expert-weighted identification confidence scores. " +
        "Returns matching fungal observations with consensus name, vote-weighted ID confidence (-3..3), date, location name, photo URL when available, and notes. " +
        "AT LEAST ONE narrowing filter is required: bbox (lat+lng+radius_km), region suffix, taxon name, or date range. Unbounded queries can return tens of MB. " +
        "For a simple 'what's fruiting near me lately?' query prefer `get_recent_fungi`. For a single observation by id prefer `get_observation`. " +
        "MO is densest in the Pacific Northwest, Northern California, the Northeastern US, and Western Europe.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        radius_km: radiusField.optional(),
        region: regionField.optional(),
        name: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Filter by consensus taxon name (substring match against MO's scientific name index). Examples: 'Amanita', 'Cantharellus formosus', 'Boletales'.",
          ),
        date_from: dateFromField.optional(),
        date_to: dateToField.optional(),
        confidence_min: confidenceMinField.optional(),
        has_images: hasImagesField.optional(),
        include_subtaxa: includeSubtaxaField.optional(),
        page: pageField.optional(),
        detail: z
          .enum(["low", "high"])
          .optional()
          .describe(
            "Detail level. 'low' (default) returns flat IDs (~1KB/record); 'high' returns nested location/consensus/owner/images objects (~3-4KB/record). Use 'high' only when needed.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const params: Parameters<typeof searchObservations>[0] = {};
      if (args.lat !== undefined && args.lng !== undefined) {
        params.coords = { lat: args.lat, lng: args.lng };
      }
      if (args.radius_km !== undefined) params.radiusKm = args.radius_km;
      if (args.region) params.region = args.region;
      if (args.name) params.name = args.name;
      if (args.date_from) params.dateFrom = args.date_from;
      if (args.date_to) params.dateTo = args.date_to;
      if (args.confidence_min !== undefined)
        params.confidenceMin = args.confidence_min;
      if (args.has_images !== undefined) params.hasImages = args.has_images;
      if (args.include_subtaxa !== undefined)
        params.includeSubtaxa = args.include_subtaxa;
      if (args.page !== undefined) params.page = args.page;
      if (args.detail) params.detail = args.detail;

      const result = await searchObservations(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_observation
// ----------------------------------------------------------------------------

function registerGetObservation(server: McpServer): void {
  server.registerTool(
    "get_observation",
    {
      title: "Get a Single Mushroom Observer Observation",
      description:
        "Returns one observation in high detail: nested location with bounding box, consensus taxon, all proposed namings with their per-naming confidence and votes, observer, primary image and full image set, and comments. Use after `search_observations` or `get_recent_fungi` returns an id of interest.",
      inputSchema: {
        id: observationIdField,
      },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const result = await getObservation(id);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// search_fungal_names
// ----------------------------------------------------------------------------

function registerSearchFungalNames(server: McpServer): void {
  server.registerTool(
    "search_fungal_names",
    {
      title: "Search Mushroom Observer Fungal Name Index",
      description:
        "Search Mushroom Observer's fungal taxonomy by substring. Returns scientific names with author citation, taxonomic rank, full classification (kingdom › phylum › class › order › family), deprecation status, and a link to the MO name page. " +
        "Use this to translate vernacular interest ('chanterelles') into MO scientific names ('Cantharellus'), to disambiguate between species in a genus, or to confirm whether a name is current vs. deprecated. " +
        "Mushroom Observer's name index covers 100,000+ fungal names including many synonyms and historical combinations.",
      inputSchema: {
        query: moNameQueryField.optional(),
        rank: moRankField.optional(),
        include_subtaxa: includeSubtaxaField.optional(),
        page: pageField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const params: Parameters<typeof searchNames>[0] = {};
      if (args.query) params.query = args.query;
      if (args.rank) params.rank = args.rank;
      if (args.include_subtaxa !== undefined)
        params.includeSubtaxa = args.include_subtaxa;
      if (args.page !== undefined) params.page = args.page;
      const result = await searchNames(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// search_regions
// ----------------------------------------------------------------------------

function registerSearchRegions(server: McpServer): void {
  server.registerTool(
    "search_regions",
    {
      title: "Discover Mushroom Observer Region/Location Names",
      description:
        "Mushroom Observer's geography is a flat list of comma-separated location names ending in a country (e.g. 'Cape Alava Trail, Olympic National Park, Clallam Co., Washington, USA'). " +
        "MO's `/locations` endpoint has NO name filter, so this tool runs an observations search with the suffix and harvests unique location-name strings from the results, with per-name observation counts. " +
        "Use to discover well-formed region suffixes before calling `search_observations` or `get_recent_fungi` with a `region` filter. " +
        "Try broad-to-narrow: 'Washington, USA' → 'Clallam Co., Washington, USA' → 'Olympic National Park, Clallam Co., Washington, USA'.",
      inputSchema: {
        query: z
          .string()
          .min(2)
          .max(200)
          .describe(
            "Suffix string to match observation locations against. The result includes only unique location_name values that END WITH this string. Examples: 'California, USA', 'Sussex, England, UK', 'Marin Co., California, USA'.",
          ),
        max_pages: maxPagesField.optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ query, max_pages }) => {
      const params: Parameters<typeof searchRegions>[0] = { query };
      if (max_pages !== undefined) params.maxPages = max_pages;
      const result = await searchRegions(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_recent_fungi — sugar tool, the headline "what's fruiting nearby" call
// ----------------------------------------------------------------------------

function registerGetRecentFungi(server: McpServer): void {
  server.registerTool(
    "get_recent_fungi",
    {
      title: "Recent Fungi Observations Near a Location",
      description:
        "Place-aware shortcut: 'what fungi have been observed near here in the last N days?' " +
        "Provide either bbox (lat+lng+radius_km) OR an MO region suffix string. Returns observations sorted by date with consensus name, confidence score, location, and photo URL. " +
        "This is the recommended starting tool for any 'what's fruiting?' question. Pages through MO results internally to fill the requested limit. " +
        "For taxonomy lookup use `search_fungal_names`. For a single record's full detail use `get_observation`. For richer filtering (taxon name, date range) use `search_observations`.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        radius_km: radiusField.optional(),
        region: regionField.optional(),
        days: daysField.optional(),
        limit: limitField.optional(),
        confidence_min: confidenceMinField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const params: Parameters<typeof getRecentNearLocation>[0] = {};
      if (
        args.lat !== undefined &&
        args.lng !== undefined &&
        args.radius_km !== undefined
      ) {
        params.coords = { lat: args.lat, lng: args.lng };
        params.radiusKm = args.radius_km;
      } else if (args.region) {
        params.region = args.region;
      }
      if (args.days !== undefined) params.days = args.days;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.confidence_min !== undefined)
        params.confidenceMin = args.confidence_min;

      const result = await getRecentNearLocation(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
