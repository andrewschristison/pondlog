import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  bboxAround,
  getDailyValues,
  getInstantaneousValues,
  getSiteInfo,
  searchSites,
} from "@pondlog/source-usgs";
import { z } from "zod";
import { failure, success } from "./respond.js";
import {
  isoDateField,
  latField,
  lngField,
  parameterCodeField,
  periodField,
  radiusField,
  siteNumberField,
  stateCodeField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerGetInstantaneousValues(server);
  registerGetDailyValues(server);
  registerGetSiteInfo(server);
  registerSearchSites(server);
}

// ----------------------------------------------------------------------------
// get_instantaneous_values — real-time gauge readings
// ----------------------------------------------------------------------------

function registerGetInstantaneousValues(server: McpServer): void {
  server.registerTool(
    "get_instantaneous_values",
    {
      title: "Real-Time USGS Streamflow / Gage Height",
      description:
        "Real-time readings (typically 15-minute cadence) from a USGS gauge. Returns one or more time series — by default discharge (00060, ft³/s) and gage height (00065, ft) — over a relative period ending now. " +
        "Use this to answer 'what is the river doing right now?'. " +
        "USGS rejects historic dates on this endpoint; for past data use `get_daily_values` with start_date/end_date instead. " +
        "For a 'what gauges exist near here?' first-step query use `search_sites`.",
      inputSchema: {
        sites: z
          .array(siteNumberField)
          .min(1)
          .describe(
            "Array of USGS site numbers to fetch in one call. Most queries pass a single site, but the API supports batched fetches.",
          ),
        parameter_codes: z
          .array(parameterCodeField)
          .optional()
          .describe(
            "Specific 5-digit parameter codes to retrieve. Defaults to ['00060', '00065'] (discharge + gage height). Pass ['00010'] for water temperature, etc.",
          ),
        period: periodField
          .optional()
          .describe(
            "Relative time window ending now. Default 'PT2H' (past 2 hours, returns ~8 readings at 15-minute cadence). 'P1D' returns ~96 readings.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getInstantaneousValues({
        sites: args.sites,
        ...(args.parameter_codes
          ? { parameterCodes: args.parameter_codes }
          : {}),
        ...(args.period ? { period: args.period } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_daily_values — daily statistics, current or historic
// ----------------------------------------------------------------------------

function registerGetDailyValues(server: McpServer): void {
  server.registerTool(
    "get_daily_values",
    {
      title: "Daily USGS Streamflow Statistics (Current or Historic)",
      description:
        "Daily statistics (default: mean) for one or more USGS gauges. Use this for any query that crosses days or asks about historic dates. " +
        "Pass either `period` (relative-to-now) OR `start_date`/`end_date` (historic range), not both. " +
        "For real-time sub-hour resolution prefer `get_instantaneous_values`. " +
        "Returns one daily value per (site × parameter × statistic × day). USGS quality codes: 'A' = approved, 'P' = provisional.",
      inputSchema: {
        sites: z
          .array(siteNumberField)
          .min(1)
          .describe("Array of USGS site numbers. Single-site queries are typical."),
        parameter_codes: z
          .array(parameterCodeField)
          .optional()
          .describe("5-digit parameter codes. Defaults to ['00060'] (discharge mean)."),
        period: periodField
          .optional()
          .describe(
            "Relative window ending now. Examples: 'P7D', 'P30D', 'P1Y'. Mutually exclusive with start_date/end_date.",
          ),
        start_date: isoDateField
          .optional()
          .describe("Historic range start (YYYY-MM-DD). Pair with end_date for an explicit window."),
        end_date: isoDateField
          .optional()
          .describe("Historic range end (YYYY-MM-DD). Defaults to today when start_date is set."),
        statistic_codes: z
          .array(z.string().regex(/^[0-9]{5}$/))
          .optional()
          .describe(
            "USGS statistic codes — '00003' = mean (default), '00001' = max, '00002' = min, '00008' = median.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const params: Parameters<typeof getDailyValues>[0] = { sites: args.sites };
      if (args.parameter_codes) params.parameterCodes = args.parameter_codes;
      if (args.period) params.period = args.period;
      if (args.start_date) params.startDt = args.start_date;
      if (args.end_date) params.endDt = args.end_date;
      if (args.statistic_codes) params.statisticCodes = args.statistic_codes;
      const result = await getDailyValues(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// get_site_info — single-site metadata
// ----------------------------------------------------------------------------

function registerGetSiteInfo(server: McpServer): void {
  server.registerTool(
    "get_site_info",
    {
      title: "USGS Gauge Site Metadata",
      description:
        "Returns metadata for a single USGS gauging station: official name, coordinates, site type (stream/lake/groundwater/etc.), hydrologic unit (HUC), state/county codes, and gauge altitude. " +
        "Use after `search_sites` finds candidate gauges, or to confirm a site number returned in someone's data.",
      inputSchema: {
        site_number: siteNumberField,
      },
      annotations: READ_ONLY,
    },
    async ({ site_number }) => {
      const result = await getSiteInfo({ siteNumber: site_number });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}

// ----------------------------------------------------------------------------
// search_sites — find gauges by location or state
// ----------------------------------------------------------------------------

function registerSearchSites(server: McpServer): void {
  server.registerTool(
    "search_sites",
    {
      title: "Find USGS Gauge Sites Near a Location",
      description:
        "Find active USGS stream-gauge sites by either (a) latitude/longitude/radius_km, or (b) US state postal code. " +
        "Returns site numbers, names, coordinates, HUC, and altitude — feed the resulting site numbers into `get_instantaneous_values` or `get_daily_values`. " +
        "Defaults filter to surface-water streams (siteType=ST) with real-time data (hasDataTypeCd=iv); pass site_type/has_data_type to override. " +
        "Pass either lat+lng+radius_km OR state_code; the lat/lng path is preferred for place-aware queries.",
      inputSchema: {
        lat: latField
          .optional()
          .describe(
            "Latitude of the search center. Required if state_code is not provided.",
          ),
        lng: lngField
          .optional()
          .describe(
            "Longitude of the search center. Required if state_code is not provided.",
          ),
        radius_km: radiusField
          .optional()
          .describe("Search radius in km around (lat, lng). Default 25."),
        state_code: stateCodeField
          .optional()
          .describe(
            "US two-letter state code. Mutually exclusive with lat/lng. Returns ALL active stream gauges in the state.",
          ),
        site_type: z
          .string()
          .min(1)
          .max(8)
          .optional()
          .describe(
            "USGS site type code: 'ST' = stream (default), 'LK' = lake, 'GW' = groundwater, 'AT' = atmosphere, 'ES' = estuary. Full list: https://help.waterdata.usgs.gov/site_tp_cd",
          ),
        has_data_type: z
          .enum(["iv", "dv", "qw", "gw"])
          .optional()
          .describe(
            "Restrict to sites that publish the given data type: 'iv' = instantaneous (real-time, default), 'dv' = daily values, 'qw' = water quality, 'gw' = groundwater levels.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const hasLatLng = args.lat !== undefined && args.lng !== undefined;
      if (!hasLatLng && !args.state_code) {
        return failure({
          source: "usgs",
          message:
            "search_sites requires either (lat + lng) or state_code (or both, but the lat/lng path takes precedence).",
        });
      }

      const params: Parameters<typeof searchSites>[0] = {};
      if (hasLatLng) {
        const radius = args.radius_km ?? 25;
        params.bbox = bboxAround(
          { lat: args.lat as number, lng: args.lng as number },
          radius,
        );
      } else if (args.state_code) {
        params.stateCode = args.state_code;
      }
      if (args.site_type) params.siteType = args.site_type;
      if (args.has_data_type) params.hasDataTypeCode = args.has_data_type;

      const result = await searchSites(params);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
