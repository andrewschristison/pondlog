// Zod schemas for the Trefle.io API response envelope.
//
// Trefle is in beta and many fields are nullable in practice (we live-probed
// the API in May 2026 and most cultivated vegetables had `null` for
// growth.days_to_harvest, growth.sowing, growth.minimum_temperature, etc).
// Schemas tolerate null/missing on every field except IDs and the
// list/detail envelope shape itself.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Common embedded objects
// ---------------------------------------------------------------------------

const TrefleLinks = z
  .object({
    self: z.string().nullable().optional(),
    plant: z.string().nullable().optional(),
    genus: z.string().nullable().optional(),
  })
  .passthrough();

const TrefleGenus = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
  })
  .passthrough();

const TrefleFamily = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    common_name: z.string().nullable().optional(),
  })
  .passthrough();

// Trefle uses { cm: number|null } / { mm: number|null } / { deg_c, deg_f } for
// quantitative fields, accept either the wrapped form or a bare number.
const QuantityCm = z
  .union([
    z.object({ cm: z.number().nullable() }).passthrough(),
    z.number(),
    z.null(),
  ])
  .optional();

const QuantityMm = z
  .union([
    z.object({ mm: z.number().nullable() }).passthrough(),
    z.number(),
    z.null(),
  ])
  .optional();

const QuantityTemp = z
  .union([
    z
      .object({
        deg_c: z.number().nullable(),
        deg_f: z.number().nullable(),
      })
      .passthrough(),
    z.null(),
  ])
  .optional();

const TrefleGrowth = z
  .object({
    description: z.string().nullable().optional(),
    sowing: z.string().nullable().optional(),
    days_to_harvest: z.number().nullable().optional(),
    row_spacing: QuantityCm,
    spread: QuantityCm,
    ph_minimum: z.number().nullable().optional(),
    ph_maximum: z.number().nullable().optional(),
    light: z.number().nullable().optional(),
    atmospheric_humidity: z.number().nullable().optional(),
    growth_months: z.array(z.string()).nullable().optional(),
    bloom_months: z.array(z.string()).nullable().optional(),
    fruit_months: z.array(z.string()).nullable().optional(),
    minimum_precipitation: QuantityMm,
    maximum_precipitation: QuantityMm,
    minimum_root_depth: QuantityCm,
    minimum_temperature: QuantityTemp,
    maximum_temperature: QuantityTemp,
    soil_nutriments: z.number().nullable().optional(),
    soil_salinity: z.number().nullable().optional(),
    soil_texture: z.number().nullable().optional(),
    soil_humidity: z.number().nullable().optional(),
  })
  .passthrough();

const TrefleSpecifications = z
  .object({
    ligneous_type: z.string().nullable().optional(),
    growth_form: z.string().nullable().optional(),
    growth_habit: z.string().nullable().optional(),
    growth_rate: z.string().nullable().optional(),
    average_height: QuantityCm,
    maximum_height: QuantityCm,
    nitrogen_fixation: z.string().nullable().optional(),
    shape_and_orientation: z.string().nullable().optional(),
    toxicity: z.string().nullable().optional(),
  })
  .passthrough();

const TrefleFlower = z
  .object({
    color: z.array(z.string()).nullable().optional(),
    conspicuous: z.boolean().nullable().optional(),
  })
  .passthrough();

const TrefleFoliage = z
  .object({
    texture: z.string().nullable().optional(),
    color: z.array(z.string()).nullable().optional(),
    leaf_retention: z.boolean().nullable().optional(),
  })
  .passthrough();

const TrefleFruitOrSeed = z
  .object({
    color: z.array(z.string()).nullable().optional(),
    shape: z.string().nullable().optional(),
    seed_persistence: z.boolean().nullable().optional(),
    conspicuous: z.boolean().nullable().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Plant (list-level summary)
// ---------------------------------------------------------------------------

export const TreflePlantSummary = z
  .object({
    id: z.number(),
    common_name: z.string().nullable().optional(),
    slug: z.string(),
    scientific_name: z.string(),
    year: z.number().nullable().optional(),
    bibliography: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    rank: z.string().nullable().optional(),
    family_common_name: z.string().nullable().optional(),
    genus_id: z.number().nullable().optional(),
    image_url: z.string().nullable().optional(),
    synonyms: z.array(z.string()).nullable().optional(),
    genus: z.string().nullable().optional(),
    family: z.string().nullable().optional(),
    links: TrefleLinks.nullable().optional(),
  })
  .passthrough();

export type TreflePlantSummary = z.infer<typeof TreflePlantSummary>;

// ---------------------------------------------------------------------------
// Plant detail (under .data) and embedded main_species
// ---------------------------------------------------------------------------

const TrefleMainSpecies = z
  .object({
    id: z.number(),
    common_name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    scientific_name: z.string().nullable().optional(),
    rank: z.string().nullable().optional(),
    family_common_name: z.string().nullable().optional(),
    genus_id: z.number().nullable().optional(),
    image_url: z.string().nullable().optional(),
    duration: z.array(z.string()).nullable().optional(),
    edible_part: z.array(z.string()).nullable().optional(),
    edible: z.boolean().nullable().optional(),
    vegetable: z.boolean().nullable().optional(),
    growth: TrefleGrowth.nullable().optional(),
    specifications: TrefleSpecifications.nullable().optional(),
    flower: TrefleFlower.nullable().optional(),
    foliage: TrefleFoliage.nullable().optional(),
    fruit_or_seed: TrefleFruitOrSeed.nullable().optional(),
    images: z.record(z.string(), z.array(z.unknown())).nullable().optional(),
    common_names: z
      .record(z.string(), z.array(z.string()).nullable())
      .nullable()
      .optional(),
    distribution: z.unknown().nullable().optional(),
    distributions: z.unknown().nullable().optional(),
    sources: z.array(z.unknown()).nullable().optional(),
    synonyms: z.array(z.unknown()).nullable().optional(),
    links: TrefleLinks.nullable().optional(),
  })
  .passthrough();

export const TreflePlantDetail = z
  .object({
    id: z.number(),
    common_name: z.string().nullable().optional(),
    slug: z.string(),
    scientific_name: z.string(),
    main_species_id: z.number().nullable().optional(),
    image_url: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    bibliography: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    family_common_name: z.string().nullable().optional(),
    genus_id: z.number().nullable().optional(),
    observations: z.string().nullable().optional(),
    vegetable: z.boolean().nullable().optional(),
    main_species: TrefleMainSpecies.nullable().optional(),
    genus: TrefleGenus.nullable().optional(),
    family: TrefleFamily.nullable().optional(),
    sources: z.array(z.unknown()).nullable().optional(),
    species: z.array(z.unknown()).nullable().optional(),
    subspecies: z.array(z.unknown()).nullable().optional(),
    varieties: z.array(z.unknown()).nullable().optional(),
    hybrids: z.array(z.unknown()).nullable().optional(),
    forms: z.array(z.unknown()).nullable().optional(),
    subvarieties: z.array(z.unknown()).nullable().optional(),
    links: TrefleLinks.nullable().optional(),
  })
  .passthrough();

export type TreflePlantDetail = z.infer<typeof TreflePlantDetail>;

// ---------------------------------------------------------------------------
// Envelope shapes
// ---------------------------------------------------------------------------

export const TrefleListEnvelope = z
  .object({
    data: z.array(TreflePlantSummary),
    meta: z
      .object({
        total: z.number(),
        last_modified: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    links: z
      .object({
        self: z.string().nullable().optional(),
        first: z.string().nullable().optional(),
        prev: z.string().nullable().optional(),
        next: z.string().nullable().optional(),
        last: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type TrefleListEnvelope = z.infer<typeof TrefleListEnvelope>;

export const TrefleDetailEnvelope = z
  .object({
    data: TreflePlantDetail,
    meta: z
      .object({
        last_modified: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type TrefleDetailEnvelope = z.infer<typeof TrefleDetailEnvelope>;
