import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getActivePhenologyNearby,
  getObservations,
  getSiteLevelData,
  getSpecies,
  getStationCountByState,
  getStations,
  getStationsByLocation,
  getStationsWithSpecies,
} from "@pondlog/source-npn";
import { z } from "zod";
import { failure, success } from "./respond.js";
import {
  latField,
  lngField,
  maxStationsField,
  phenophaseIdField,
  radiusField,
  speciesIdField,
  stateCodeField,
  stationIdField,
  yearField,
  yearsBackField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerSearchSpecies(server);
  registerGetStationsInState(server);
  registerGetStationCountByState(server);
  registerGetStationsWithSpecies(server);
  registerGetStationsByLocation(server);
  registerGetObservations(server);
  registerGetSiteLevelData(server);
  registerGetActivePhenologyNearby(server);
}

// ----------------------------------------------------------------------------
// search_species, list-and-filter NPN's full species catalog
// ----------------------------------------------------------------------------

function registerSearchSpecies(server: McpServer): void {
  server.registerTool(
    "search_species",
    {
      title: "Search USA-NPN Species Catalog",
      description:
        "Search the USA-NPN species catalog (~1,900 species). Returns matching species with NPN species_id, scientific name, common name, kingdom (Plantae/Animalia/Fungi). " +
        "Use this first to look up a species_id before calling other tools that take species filters. " +
        "All filters are case-insensitive. Filters compound: passing query + kingdom narrows further.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Substring match against the common name OR scientific binomial. Example: 'maple' matches all maples; 'saguaro' matches saguaro cactus. Optional.",
          ),
        genus: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Exact-match (case-insensitive) genus filter. Example: 'Acer' for maples, 'Quercus' for oaks. Optional.",
          ),
        kingdom: z
          .enum(["Plantae", "Animalia", "Fungi"])
          .optional()
          .describe(
            "Kingdom filter. NPN data is dominated by Plantae (most phenology is plant-based) but also tracks Animalia (birds, insects, mammals) and a small set of Fungi. Optional.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getSpecies();
      if (!result.ok) return failure(result.error);

      let rows = result.data;
      if (args.kingdom) {
        const k = args.kingdom;
        rows = rows.filter((r) => r.iconicTaxon === k);
      }
      if (args.genus) {
        const g = args.genus.toLowerCase();
        rows = rows.filter(
          (r) => r.name.split(" ")[0]?.toLowerCase() === g,
        );
      }
      if (args.query) {
        const q = args.query.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.commonName.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q),
        );
      }
      // Cap to keep responses sane for the LLM.
      return success(rows.slice(0, 200));
    },
  );
}

// ----------------------------------------------------------------------------
// get_stations_in_state
// ----------------------------------------------------------------------------

function registerGetStationsInState(server: McpServer): void {
  server.registerTool(
    "get_stations_in_state",
    {
      title: "List NPN Stations in a US State",
      description:
        "List all USA-NPN observation stations in a given US state. Returns each station's NPN station_id, name, coordinates, and (when applicable) network ID. " +
        "Pass `state_code` to narrow. NPN's unfiltered list is ~50,000 stations. Use station_ids returned here to filter `get_observations` or `get_site_level_data`.",
      inputSchema: {
        state_code: stateCodeField,
      },
      annotations: READ_ONLY,
    },
    async ({ state_code }) => {
      const result = await getStations({ stateCode: state_code });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_station_count_by_state
// ----------------------------------------------------------------------------

function registerGetStationCountByState(server: McpServer): void {
  server.registerTool(
    "get_station_count_by_state",
    {
      title: "USA-NPN Station Count by State",
      description:
        "Returns the number of USA-NPN stations per US state (a quick map of NPN's geographic coverage). Useful for deciding which state to query for phenology data, eastern US states (NY, MA, ME) and Arizona have the densest coverage; Pacific Northwest is sparser.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const result = await getStationCountByState();
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_stations_with_species
// ----------------------------------------------------------------------------

function registerGetStationsWithSpecies(server: McpServer): void {
  server.registerTool(
    "get_stations_with_species",
    {
      title: "Find NPN Stations Observing Specific Species",
      description:
        "Returns all NPN stations that have observations for any of the given species. Use to answer 'where in the US can I find phenology data for saguaro?' " +
        "Note: due to a known upstream NPN bug, some species (notably species_id=3, red maple) return an empty result; the tool surfaces these as empty arrays rather than errors.",
      inputSchema: {
        species_ids: z
          .array(speciesIdField)
          .min(1)
          .describe(
            "Array of NPN species IDs (at least one). Use `search_species` first to look IDs up. Example: [210] for saguaro.",
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ species_ids }) => {
      const result = await getStationsWithSpecies({ speciesIds: species_ids });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_stations_by_location (WKT polygon)
// ----------------------------------------------------------------------------

function registerGetStationsByLocation(server: McpServer): void {
  server.registerTool(
    "get_stations_by_location",
    {
      title: "Find NPN Stations Inside a WKT Polygon",
      description:
        "Returns NPN stations inside a Well-Known Text polygon. NPN's spatial filter is WKT-based, not lat/lng/radius. " +
        "WKT format example: 'POLYGON((-123.7 47.9, -123.0 47.9, -123.0 48.3, -123.7 48.3, -123.7 47.9))', coordinate pairs are 'lng lat', the polygon must close (first point repeated as last). " +
        "For most use cases prefer `get_active_phenology_nearby` which builds the WKT from coords + radius internally.",
      inputSchema: {
        wkt: z
          .string()
          .min(8)
          .describe(
            "Well-Known Text polygon string. Coordinate order is 'lng lat'. The polygon must close.",
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ wkt }) => {
      const result = await getStationsByLocation({ wkt });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_observations
// ----------------------------------------------------------------------------

function registerGetObservations(server: McpServer): void {
  server.registerTool(
    "get_observations",
    {
      title: "Get USA-NPN Phenology Status/Intensity Records",
      description:
        "Status / intensity observation records, individual observer reports of whether a phenophase was 'yes' (1), 'no' (0), or 'uncertain' (-1) on a given date. This is the rawest NPN data type. " +
        "REQUIRES a year filter and at least one narrowing filter (species/station/state/genus/family/order/class). Unfiltered queries can return tens of MB. " +
        "For 'is this in phenology now?' aggregated answers prefer `get_site_level_data`. For a place-aware 'what's recently active' shortcut prefer `get_active_phenology_nearby`.",
      inputSchema: {
        years: z
          .array(yearField)
          .min(1)
          .describe(
            "Calendar years to include, e.g. [2024] or [2023, 2024]. NPN data starts in 2009. Required.",
          ),
        species_ids: z
          .array(speciesIdField)
          .optional()
          .describe("Narrow to specific species. Optional."),
        station_ids: z
          .array(stationIdField)
          .optional()
          .describe(
            "Narrow to specific NPN stations. Note: a single station-year of observations can be 80+ MB for prolific stations; combine with `species_ids` when possible.",
          ),
        states: z
          .array(stateCodeField)
          .optional()
          .describe("Narrow to one or more US state postal codes. Optional."),
        phenophase_ids: z
          .array(phenophaseIdField)
          .optional()
          .describe(
            "Narrow to specific phenophases (e.g. 501 = open flowers, 371 = breaking leaf buds). Optional.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getObservations({
        years: args.years,
        ...(args.species_ids ? { speciesIds: args.species_ids } : {}),
        ...(args.station_ids ? { stationIds: args.station_ids } : {}),
        ...(args.states ? { states: args.states } : {}),
        ...(args.phenophase_ids ? { phenophaseIds: args.phenophase_ids } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_site_level_data
// ----------------------------------------------------------------------------

function registerGetSiteLevelData(server: McpServer): void {
  server.registerTool(
    "get_site_level_data",
    {
      title: "Get USA-NPN Site-Level Phenometric Summaries",
      description:
        "Per-site phenometric aggregates: for each (site, species, phenophase, year), returns the mean first/last 'yes' date (when phenophase began and ended on average across observed individuals). " +
        "This is the right granularity for 'when do magnolias typically bloom in WA?', much smaller than `get_observations`. " +
        "REQUIRES a year filter and at least one of species_ids/station_ids/states. Site-level dates are returned as both julian-day (mean*Julian) and ISO date (mean*Date). " +
        "Sample size fields (firstYesSampleSize, lastYesSampleSize) tell you how many individuals contributed to the mean.",
      inputSchema: {
        years: z
          .array(yearField)
          .min(1)
          .describe(
            "Calendar years to include. NPN phenometric records typically lag by a year, 2024 is the most recent year with broad coverage as of 2026. Required.",
          ),
        species_ids: z
          .array(speciesIdField)
          .optional()
          .describe("Narrow to specific species. Optional."),
        station_ids: z
          .array(stationIdField)
          .optional()
          .describe(
            "Narrow to specific NPN stations. Note: parameter name is `station_id` (singular) on the wire, the tool handles that translation.",
          ),
        states: z
          .array(stateCodeField)
          .optional()
          .describe("Narrow to one or more US state postal codes. Optional."),
        phenophase_ids: z
          .array(phenophaseIdField)
          .optional()
          .describe("Narrow to specific phenophase IDs. Optional."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getSiteLevelData({
        years: args.years,
        ...(args.species_ids ? { speciesIds: args.species_ids } : {}),
        ...(args.station_ids ? { stationIds: args.station_ids } : {}),
        ...(args.states ? { states: args.states } : {}),
        ...(args.phenophase_ids ? { phenophaseIds: args.phenophase_ids } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_active_phenology_nearby, composed helper
// ----------------------------------------------------------------------------

function registerGetActivePhenologyNearby(server: McpServer): void {
  server.registerTool(
    "get_active_phenology_nearby",
    {
      title: "Recently Recorded Phenology Near Coordinates",
      description:
        "Place-aware shortcut: 'what phenology has been recorded near these coordinates?' " +
        "Composes a WKT bounding box from coords+radius, finds NPN stations inside, haversine-filters to true radius, and returns the closest stations' site-level phenometric records over the requested years (sorted by most-recent meanLastYesDate). " +
        "Each entry includes `distanceKm` from the query point. " +
        "Note: NPN station coverage is patchy. Eastern US and Arizona are dense; the Pacific Northwest is sparser. Use `get_station_count_by_state` to gauge regional coverage. " +
        "For raw observation records, use `get_observations`. For state-wide phenometric summaries, use `get_site_level_data`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        radius_km: radiusField.describe("Search radius in km. Default 25."),
        years_back: yearsBackField
          .optional()
          .describe(
            "How many years of phenometric history to include. Default 2 (this year + last). Increase to 5 or 10 in regions with sparse coverage.",
          ),
        max_stations: maxStationsField
          .optional()
          .describe(
            "Maximum stations to query (closest first). Default 40, max 50. Cap exists because NPN's URL length limit caps repeated `station_id` parameters.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getActivePhenologyNearby({
        coords: { lat: args.lat, lng: args.lng },
        radiusKm: args.radius_km,
        ...(args.years_back !== undefined ? { yearsBack: args.years_back } : {}),
        ...(args.max_stations !== undefined ? { maxStations: args.max_stations } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
