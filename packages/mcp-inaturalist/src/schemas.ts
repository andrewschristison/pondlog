import { z } from "zod";

const ICONIC_TAXA = [
  "Aves",
  "Amphibia",
  "Mammalia",
  "Reptilia",
  "Insecta",
  "Arachnida",
  "Mollusca",
  "Plantae",
  "Fungi",
  "Actinopterygii",
  "Animalia",
  "Protozoa",
  "Chromista",
] as const;

export const ICONIC_TAXA_HELP = [
  "Aves = birds",
  "Amphibia = frogs, salamanders, newts",
  "Mammalia = mammals",
  "Reptilia = reptiles",
  "Insecta = insects",
  "Arachnida = spiders, scorpions, mites",
  "Mollusca = snails, slugs, clams, octopuses",
  "Plantae = plants",
  "Fungi = fungi, lichens",
  "Actinopterygii = ray-finned fish",
  "Animalia = catch-all animal kingdom (use only when others don't fit)",
  "Protozoa, Chromista = microscopic eukaryotes",
].join("; ");

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

export const daysField = z
  .number()
  .int()
  .min(1)
  .max(365)
  .describe(
    "Time window in days, counted backwards from today. Default 7. Use 1 for today, 7 for this week, 30 for this month, 365 for this year.",
  );

export const iconicTaxaField = z
  .array(z.enum(ICONIC_TAXA))
  .min(1)
  .describe(
    `Filter to one or more iNaturalist iconic-taxa groups. ${ICONIC_TAXA_HELP}.`,
  );

export const qualityGradeField = z
  .enum(["research", "needs_id", "casual"])
  .describe(
    "iNaturalist quality grade. 'research' = community-verified IDs (most reliable); 'needs_id' = uploaded but not yet verified; 'casual' = excluded from research-grade pool. Default: no filter (all grades).",
  );

export const taxonNameField = z
  .string()
  .min(1)
  .describe(
    "Taxon name to filter by. Accepts common name (e.g. 'frog', 'bald eagle') or scientific name (e.g. 'Pseudacris regilla'). Partial matches work.",
  );

export type IconicTaxonName = (typeof ICONIC_TAXA)[number];
