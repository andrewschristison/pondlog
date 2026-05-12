import { z } from "zod";

// Coordinate fields shared with the source-search tool.
export const latField = z
  .number()
  .min(-90)
  .max(90)
  .describe(
    "WGS84 latitude in decimal degrees, between -90 and 90. Example: 48.118 for Port Angeles, WA.",
  );

export const lngField = z
  .number()
  .min(-180)
  .max(180)
  .describe(
    "WGS84 longitude in decimal degrees, between -180 and 180. Example: -123.4307 for Port Angeles, WA.",
  );

export const radiusField = z
  .number()
  .positive()
  .max(350)
  .describe(
    "Search radius in kilometers around the (lat, lng) point. Maximum 350 km (USGS bbox API limits dimensions to ~7°). Default 25.",
  );

export const siteNumberField = z
  .string()
  .regex(/^[0-9]{8,15}$/)
  .describe(
    "USGS site number, 8 to 15 digits identifying a single gauging station. Examples: '12045500' (Elwha River at McDonald Bridge near Port Angeles, WA); '12048000' (Dungeness River near Sequim, WA). Use `search_sites` to discover site numbers for a region.",
  );

export const stateCodeField = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .describe(
    "US two-letter state postal code (e.g. 'WA', 'CA', 'NY'). Use to find all USGS gauges in a state.",
  );

export const periodField = z
  .string()
  .regex(/^P(?:T?\d+[YMDHS])+$/)
  .describe(
    "ISO-8601 duration ending now. Examples: 'PT2H' = past 2 hours, 'P1D' = past 24 hours, 'P7D' = past week, 'P30D' = past 30 days. Use for relative-to-now queries, for historic ranges with explicit dates use start_date/end_date instead.",
  );

export const isoDateField = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .describe("ISO date in YYYY-MM-DD format (e.g. '2024-01-15').");

// USGS parameter codes are 5-digit identifiers. The most common ones for surface water:
//   00060 = Discharge / streamflow (ft³/s)
//   00065 = Gage height (ft)
//   00010 = Water temperature (°C)
//   00400 = pH
//   00095 = Specific conductance (μS/cm @ 25 °C)
// Full list: https://help.waterdata.usgs.gov/codes-and-parameters/parameters
export const parameterCodeField = z
  .string()
  .regex(/^[0-9]{5}$/)
  .describe(
    "USGS 5-digit parameter code. Common values: '00060' = streamflow / discharge in ft³/s; '00065' = gage height in feet; '00010' = water temperature in °C. Full list: https://help.waterdata.usgs.gov/codes-and-parameters/parameters",
  );
