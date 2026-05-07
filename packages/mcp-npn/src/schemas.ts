import { z } from "zod";

// Coordinate fields shared across geo tools.
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
  .max(500)
  .describe(
    "Search radius in kilometers. Maximum 500. Default 25. Use smaller values (5-25 km) for hyper-local queries; larger values (50-200 km) for regional surveys.",
  );

export const yearsBackField = z
  .number()
  .int()
  .min(1)
  .max(20)
  .describe(
    "How many years of phenometric history to include, counted backwards from this year. Default 2 (this year + last). NPN phenology data typically lags by a year, so yearsBack=2 is a reasonable default to surface recent records.",
  );

export const maxStationsField = z
  .number()
  .int()
  .min(1)
  .max(50)
  .describe(
    "Cap on stations queried by `get_active_phenology_nearby`, closest first. Default 40. Maximum 50 (NPN's URL length limit).",
  );

// US two-letter state postal code.
export const stateCodeField = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .describe(
    "US two-letter state postal code (e.g. 'WA', 'CA', 'NY'). Required for narrowing station and observation queries — NPN's unfiltered station list is ~50,000 records.",
  );

// Year for getObservations / getSiteLevelData filters. NPN phenology records start in 2009.
export const yearField = z
  .number()
  .int()
  .min(2009)
  .max(9999)
  .describe(
    "Calendar year. NPN phenology records start in 2009. Multiple years can be passed in the `years` array.",
  );

// Species id (NPN-internal identifier, e.g. 26 = mayapple, 210 = saguaro).
export const speciesIdField = z
  .number()
  .int()
  .positive()
  .describe(
    "NPN species ID (positive integer). Use `search_species` first to look one up by name. Examples: 26 = mayapple, 210 = saguaro, 3 = red maple.",
  );

// Station id (NPN-internal site identifier).
export const stationIdField = z
  .number()
  .int()
  .positive()
  .describe(
    "NPN station/site ID (positive integer). Use `get_stations_in_state` to discover IDs for a region.",
  );

// Phenophase id, e.g. 482 = "Initial growth (forbs)".
export const phenophaseIdField = z
  .number()
  .int()
  .positive()
  .describe(
    "NPN phenophase ID (positive integer). Examples: 371 = breaking leaf buds, 482 = initial growth, 501 = open flowers.",
  );
