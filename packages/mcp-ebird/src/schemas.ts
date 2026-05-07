import { z } from "zod";

export const REGION_CODE_HELP =
  "eBird region codes are hierarchical: country (e.g. \"US\", \"CA\"), subnational1 = state/province (e.g. \"US-WA\"), subnational2 = county/equivalent (e.g. \"US-WA-009\" for Clallam County, WA). Use a more specific code for tighter scope.";

export const SPECIES_CODE_HELP =
  "eBird species codes are short alphanumeric identifiers (typically 6 chars), e.g. \"amecro\" = American Crow, \"barowl\" = Barred Owl, \"baleag\" = Bald Eagle, \"rufhum\" = Rufous Hummingbird. Use `get_taxonomy` to look up codes by name.";

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

export const distField = z
  .number()
  .min(0)
  .max(50)
  .describe(
    "Search radius in kilometers. eBird's geo endpoints cap this at 50 km. Default 25.",
  );

export const backField = z
  .number()
  .int()
  .min(1)
  .max(30)
  .describe(
    "Time window in days, counted backwards from today. eBird caps this at 30 days. Default 14 (eBird's API default).",
  );

export const regionCodeField = z
  .string()
  .min(2)
  .max(12)
  .regex(/^[A-Za-z0-9-]+$/)
  .describe(`eBird region code. ${REGION_CODE_HELP}`);

export const speciesCodeField = z
  .string()
  .min(4)
  .max(10)
  .regex(/^[a-z0-9]+$/)
  .describe(`eBird species code (lowercase). ${SPECIES_CODE_HELP}`);

export const subIdField = z
  .string()
  .regex(/^S\d+$/)
  .describe(
    "eBird checklist submission ID. Format: capital S followed by digits, e.g. \"S987654321\". Found in eBird checklist URLs (https://ebird.org/checklist/<subId>).",
  );

export const locIdField = z
  .string()
  .regex(/^L\d+$/)
  .describe(
    "eBird location ID for a hotspot or personal location. Format: capital L followed by digits, e.g. \"L123456\".",
  );

export const yearField = z
  .number()
  .int()
  .min(1800)
  .max(9999)
  .describe("Four-digit year (Gregorian). Example: 2025.");

export const monthField = z
  .number()
  .int()
  .min(1)
  .max(12)
  .describe("Month number, 1-12. Example: 5 for May.");

export const dayField = z
  .number()
  .int()
  .min(1)
  .max(31)
  .describe("Day of month, 1-31. Example: 1.");

export const maxResultsField = z
  .number()
  .int()
  .min(1)
  .describe("Maximum results to return. Per-endpoint limits apply (see field description).");

export const detailField = z
  .enum(["simple", "full"])
  .describe(
    "Response detail level. \"simple\" (default) returns minimal fields and is faster; \"full\" includes additional metadata at the cost of larger responses.",
  );

export const sortField = z
  .enum(["date", "species"])
  .describe(
    "Sort order. \"date\" (default) returns most recent first; \"species\" sorts alphabetically by taxon order.",
  );

export const includeProvisionalField = z
  .boolean()
  .describe(
    "If true, include unreviewed (provisional) observations. Default false. Provisional observations may be flagged or revised by reviewers later.",
  );

export const hotspotOnlyField = z
  .boolean()
  .describe(
    "If true, restrict to eBird hotspot locations only (excluding personal/private locations). Default false.",
  );

export const cmpField = z
  .enum(["domestic", "form", "hybrid", "intergrade", "issf", "slash", "species", "spuh"])
  .describe(
    "Filter by taxonomic category: species (default category for normal birds), issf (subspecies), hybrid, form, intergrade, domestic (escaped/feral), slash (uncertain between two), spuh (unknown to species).",
  );

export const sppLocaleField = z
  .string()
  .min(2)
  .describe(
    "Locale code for common names, e.g. \"en\" (English), \"es\" (Spanish), \"fr\" (French). Use `get_taxa_locales` to list supported locales. Default \"en\".",
  );

export const regionTypeField = z
  .enum(["country", "subnational1", "subnational2"])
  .describe(
    "Region tier to enumerate. \"country\" lists countries (parentRegionCode = \"world\"); \"subnational1\" lists states/provinces of a country (e.g. parentRegionCode = \"US\"); \"subnational2\" lists counties/equivalents of a state (e.g. parentRegionCode = \"US-WA\").",
  );

export const speciesGroupingField = z
  .enum(["merlin", "ebird"])
  .describe(
    "Which species-grouping taxonomy to use. \"ebird\" returns the standard eBird taxonomic groups (taxonomic order); \"merlin\" returns the field-friendly groups used in the Merlin Bird ID app (life-list categories).",
  );
