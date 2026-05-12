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

export const radiusField = z
  .number()
  .positive()
  .max(500)
  .describe(
    "Search radius in kilometers. Maximum 500. Default 25. Mushroom Observer is densest in the Pacific Northwest, Northern California, the Northeast US, and Western Europe; use 50–100 km for coverage in sparser regions.",
  );

export const daysField = z
  .number()
  .int()
  .min(1)
  .max(365)
  .describe(
    "Time window in days, counted backwards from today. Default 30. Fungi fruit seasonally, values around 30–90 days surface 'currently fruiting' species; longer windows (180–365) build a year-round portrait.",
  );

export const limitField = z
  .number()
  .int()
  .min(1)
  .max(200)
  .describe(
    "Maximum number of observations to return. Default 50, max 200. The server pages through MO results internally up to 5 pages.",
  );

export const confidenceMinField = z
  .number()
  .min(-3)
  .max(3)
  .describe(
    "Minimum vote-weighted ID confidence in [-3..3]. MO observations carry consensus confidence aggregated from votes by mycology experts and citizen scientists. 1.0+ is a reasonable threshold to filter out uncertain IDs; 2.0+ is strong consensus; negative values mean the consensus name is disputed.",
  );

export const regionField = z
  .string()
  .min(2)
  .max(200)
  .describe(
    "Mushroom Observer region suffix string. MO models geography as comma-separated location names ending in country (e.g. 'Clallam Co., Washington, USA', 'Marin Co., California, USA', 'Sussex, England, UK'). The filter is a SUFFIX match, provide the most-specific tail you want; broader suffixes match more locations. Use `search_regions` first to discover well-formed suffixes.",
  );

export const observationIdField = z
  .number()
  .int()
  .positive()
  .describe(
    "Mushroom Observer observation id (positive integer). The numeric segment of an MO URL like https://mushroomobserver.org/187521.",
  );

export const moNameQueryField = z
  .string()
  .min(1)
  .max(100)
  .describe(
    "Substring search against MO's scientific-name index (uses MO's `text_name_has` filter). Examples: 'Cantharellus' (the chanterelle genus), 'Amanita muscaria' (the species), 'Boletales' (an order). Case-insensitive.",
  );

export const moRankField = z
  .enum([
    "Class",
    "Domain",
    "Family",
    "Form",
    "Genus",
    "Group",
    "Kingdom",
    "Order",
    "Phylum",
    "Section",
    "Series",
    "Species",
    "Stirps",
    "Subclass",
    "Subfamily",
    "Subgenus",
    "Suborder",
    "Subphylum",
    "Subsection",
    "Subspecies",
    "Subtribe",
    "Tribe",
    "Variety",
  ])
  .describe(
    "Taxonomic rank filter for `search_fungal_names`. Most fungi searches care about Genus, Species, Family, or Order. MO's full set is exposed.",
  );

export const dateFromField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe(
    "Inclusive lower bound on observation date in YYYY-MM-DD format. Example: '2025-09-01'.",
  );

export const dateToField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe(
    "Inclusive upper bound on observation date in YYYY-MM-DD format. Example: '2025-12-01'.",
  );

export const hasImagesField = z
  .boolean()
  .describe(
    "If true, only return observations that have at least one photo. Useful for visual ID workflows.",
  );

export const includeSubtaxaField = z
  .boolean()
  .describe(
    "If true, include observations of subtaxa under the queried name (e.g. all species in a genus). Default false.",
  );

export const pageField = z
  .number()
  .int()
  .min(1)
  .max(100)
  .describe(
    "1-indexed page number. MO returns ~100 records per page. Default 1.",
  );

export const maxPagesField = z
  .number()
  .int()
  .min(1)
  .max(5)
  .describe(
    "Maximum pages of observations to scan when discovering region suffixes. Default 2. MO returns ~100 obs/page; the tool aggregates unique location names across the scanned pages.",
  );
