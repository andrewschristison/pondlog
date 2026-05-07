import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getIconicTaxaSummary,
  getNearbyObservations,
  getObservation,
  getObservers,
  getSpeciesCounts,
  getTaxon,
  searchObservations,
  searchPlaces,
  searchTaxa,
} from "@pondlog/source-inaturalist";
import { z } from "zod";
import { failure, success } from "./respond.js";
import {
  daysField,
  iconicTaxaField,
  ICONIC_TAXA_HELP,
  latField,
  lngField,
  qualityGradeField,
  radiusField,
  taxonNameField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerSearchObservations(server);
  registerGetObservation(server);
  registerGetSpeciesCounts(server);
  registerSearchTaxa(server);
  registerGetTaxon(server);
  registerGetNearbyObservations(server);
  registerGetIconicTaxaSummary(server);
  registerSearchPlaces(server);
  registerGetObservers(server);
}

function registerSearchObservations(server: McpServer): void {
  server.registerTool(
    "search_observations",
    {
      title: "Search iNaturalist Observations",
      description:
        "Search recent iNaturalist observations with rich filters: geographic radius, taxon, iconic group, date range, and quality grade. Returns up to `per_page` normalized observations (species name, observer, place, observed date, coordinates, URL). " +
        "Use this when the caller asks for specific kinds of observations ('show me bird sightings near Olympic National Park last month'). " +
        "For a simple 'what's nearby' query, prefer `get_nearby_observations`. For aggregate counts, prefer `get_species_counts`.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        radius_km: radiusField
          .optional()
          .describe(
            "Geographic search radius in km. Required if `lat`/`lng` are provided. Default 25 when geo-searching. Maximum 500.",
          ),
        taxon_name: taxonNameField.optional(),
        iconic_taxa: iconicTaxaField.optional(),
        d1: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Start date (inclusive), ISO YYYY-MM-DD. Example: 2025-04-01."),
        d2: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("End date (inclusive), ISO YYYY-MM-DD. Example: 2025-04-30."),
        quality_grade: qualityGradeField.optional(),
        order_by: z
          .enum(["created_at", "observed_on", "species_guess", "votes", "id"])
          .optional()
          .describe(
            "Sort order. 'observed_on' for chronological by sighting date (most useful); 'created_at' for upload order; 'votes' for community-favorited.",
          ),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Results per page. Default 30, maximum 200."),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Page number, 1-indexed. iNaturalist caps page * per_page at 10,000."),
        place_id: z
          .number()
          .int()
          .optional()
          .describe(
            "iNaturalist place ID. Use `search_places` first to look one up. Filters to a named region rather than lat/lng radius.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await searchObservations({
        ...(args.lat !== undefined ? { lat: args.lat } : {}),
        ...(args.lng !== undefined ? { lng: args.lng } : {}),
        ...(args.radius_km !== undefined ? { radiusKm: args.radius_km } : {}),
        ...(args.taxon_name ? { taxonName: args.taxon_name } : {}),
        ...(args.iconic_taxa ? { iconicTaxa: args.iconic_taxa } : {}),
        ...(args.d1 ? { d1: args.d1 } : {}),
        ...(args.d2 ? { d2: args.d2 } : {}),
        ...(args.quality_grade ? { qualityGrade: args.quality_grade } : {}),
        ...(args.order_by ? { orderBy: args.order_by } : {}),
        ...(args.per_page !== undefined ? { perPage: args.per_page } : {}),
        ...(args.page !== undefined ? { page: args.page } : {}),
        ...(args.place_id !== undefined ? { placeId: args.place_id } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetObservation(server: McpServer): void {
  server.registerTool(
    "get_observation",
    {
      title: "Get iNaturalist Observation Detail",
      description:
        "Fetch a single observation by its iNaturalist ID, with full detail: photos, description, identification count, comment count, plus all the fields from the search response. Use after `search_observations` returns a result the caller wants to drill into.",
      inputSchema: {
        id: z
          .union([z.number().int(), z.string().regex(/^\d+$/)])
          .describe("iNaturalist observation ID. Numeric or numeric string."),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const result = await getObservation(id);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetSpeciesCounts(server: McpServer): void {
  server.registerTool(
    "get_species_counts",
    {
      title: "iNaturalist Species Counts at a Location",
      description:
        "Returns a count of observations per species for a geographic + temporal query. Each row: taxon name, common name, iconic group, observation count. Use this for 'what species have been seen here' rather than 'show me each individual sighting'. " +
        "For a higher-level summary grouped by iconic taxa, use `get_iconic_taxa_summary` instead.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        radius_km: radiusField.optional(),
        iconic_taxa: iconicTaxaField.optional(),
        d1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        d2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        per_page: z.number().int().min(1).max(200).optional(),
        page: z.number().int().min(1).optional(),
        place_id: z.number().int().optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getSpeciesCounts({
        ...(args.lat !== undefined ? { lat: args.lat } : {}),
        ...(args.lng !== undefined ? { lng: args.lng } : {}),
        ...(args.radius_km !== undefined ? { radiusKm: args.radius_km } : {}),
        ...(args.iconic_taxa ? { iconicTaxa: args.iconic_taxa } : {}),
        ...(args.d1 ? { d1: args.d1 } : {}),
        ...(args.d2 ? { d2: args.d2 } : {}),
        ...(args.per_page !== undefined ? { perPage: args.per_page } : {}),
        ...(args.page !== undefined ? { page: args.page } : {}),
        ...(args.place_id !== undefined ? { placeId: args.place_id } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerSearchTaxa(server: McpServer): void {
  server.registerTool(
    "search_taxa",
    {
      title: "Search iNaturalist Taxa",
      description:
        "Search the iNaturalist taxonomy by name (common or scientific). Returns up to 30 matching taxa with id, scientific name, common name, rank (species/genus/family/etc.), and iconic group. Use this to look up a taxon ID before passing it to other tools, or to confirm a species is in iNat's taxonomy.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Search term. Common name ('bald eagle') or scientific name ('Haliaeetus leucocephalus'). Partial matches work.",
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      const result = await searchTaxa(query);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetTaxon(server: McpServer): void {
  server.registerTool(
    "get_taxon",
    {
      title: "Get iNaturalist Taxon Detail",
      description:
        "Fetch a single taxon by ID, with full detail: ancestry chain, Wikipedia URL, total observations count, default photo. Use after `search_taxa` to drill into a specific match.",
      inputSchema: {
        id: z
          .union([z.number().int(), z.string().regex(/^\d+$/)])
          .describe("iNaturalist taxon ID."),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const result = await getTaxon(id);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetNearbyObservations(server: McpServer): void {
  server.registerTool(
    "get_nearby_observations",
    {
      title: "Get Nearby iNaturalist Observations",
      description:
        "Convenience tool for the most common query: 'what wildlife has been seen near these coordinates recently?' Returns up to 50 observations within `radius_km` over the last `days` days, ordered by observation date. " +
        "For more control (taxon filters, date ranges, sort order), use `search_observations` instead.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField.optional().describe("Default 25 km."),
        days: daysField.optional().describe("Default 7 days."),
      },
      annotations: READ_ONLY,
    },
    async ({ lat, lng, radius_km, days }) => {
      const result = await getNearbyObservations(
        { lat, lng },
        radius_km,
        days,
      );
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetIconicTaxaSummary(server: McpServer): void {
  server.registerTool(
    "get_iconic_taxa_summary",
    {
      title: "Iconic Taxa Summary at a Location",
      description:
        "Returns a high-level breakdown of recent activity grouped by iconic taxa group (Aves, Amphibia, Mammalia, etc.). For each group, returns the total observation count and the top 5 species by count. " +
        `Useful for at-a-glance summaries. ${ICONIC_TAXA_HELP}.`,
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField.optional().describe("Default 25 km."),
        days: daysField.optional().describe("Default 7 days."),
      },
      annotations: READ_ONLY,
    },
    async ({ lat, lng, radius_km, days }) => {
      const result = await getIconicTaxaSummary({ lat, lng }, radius_km, days);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerSearchPlaces(server: McpServer): void {
  server.registerTool(
    "search_places",
    {
      title: "Search iNaturalist Places",
      description:
        "Look up an iNaturalist 'place' (named region: park, county, country, etc.) by name. Returns up to 10 matches with id, display name, and (when available) coordinates. Use to convert a place name into a `place_id` you can pass to `search_observations` or `get_species_counts`.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Place name. Example: 'Olympic National Park', 'Clallam County', 'Port Angeles'."),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      const result = await searchPlaces(query);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

function registerGetObservers(server: McpServer): void {
  server.registerTool(
    "get_observers",
    {
      title: "Top iNaturalist Observers at a Location",
      description:
        "Returns the top observers (most prolific iNaturalist users) for a given geographic + temporal query. Each row: user id, login, display name, observation count, species count. Use this to find local naturalists or to credit who is documenting an area.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField.optional().describe("Default 25 km."),
        days: daysField.optional().describe("Default 7 days."),
      },
      annotations: READ_ONLY,
    },
    async ({ lat, lng, radius_km, days }) => {
      const result = await getObservers({ lat, lng }, radius_km, days);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
