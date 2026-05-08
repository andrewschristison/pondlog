import { z } from "zod";

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

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe(
    "ISO date YYYY-MM-DD. Defaults to today (UTC). Used to anchor the briefing — affects tides, sun/moon times, and the night-sky reference time.",
  );

export const radiusField = z
  .number()
  .positive()
  .max(500)
  .describe(
    "Search radius in kilometers. Maximum 500. Default 25. Use smaller values (5-25 km) for hyper-local queries.",
  );

export const daysField = z
  .number()
  .int()
  .min(1)
  .max(30)
  .describe(
    "Time window in days, counted backwards from today. Default 7 days. Maximum 30.",
  );

export const noaaStationField = z
  .string()
  .regex(/^[0-9]{6,8}$/)
  .describe(
    "NOAA CO-OPS tide station id, 6–8 digits. Example: '9444090' (Port Angeles, WA). Find a nearby station at https://tidesandcurrents.noaa.gov/. Optional — when omitted (and NOAA_STATION env var unset) tides are skipped.",
  );

export const usgsSiteField = z
  .string()
  .regex(/^[0-9]{8,15}$/)
  .describe(
    "USGS streamgauge site number, 8–15 digits. Example: '12045500' (Elwha River near Port Angeles, WA). Find one at https://waterdata.usgs.gov/. Optional — when omitted (and USGS_SITE env var unset) streamflow is skipped.",
  );

export const ebirdApiKeyField = z
  .string()
  .min(1)
  .describe(
    "eBird API key (free, request at https://ebird.org/api/keygen). Optional override of the EBIRD_API_KEY env var. When neither is set, the eBird section is reported as an error and other sources still populate.",
  );

export const yearsBackField = z
  .number()
  .int()
  .min(1)
  .max(20)
  .describe(
    "Years of NPN phenometric history to summarize, counting backwards from current year. Default 2 (this year + last). Maximum 20.",
  );

export const mushroomObserverRegionField = z
  .string()
  .min(2)
  .max(200)
  .describe(
    'Mushroom Observer region suffix string (e.g. "Clallam Co., Washington, USA"). Optional. When provided, the MO section uses suffix-match region filtering instead of bbox — useful when MO coverage at the bbox is sparse or when the caller wants county/state-wide fungi.',
  );
