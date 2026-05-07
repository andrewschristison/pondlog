import { z } from "zod";

const InatTaxonSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    preferred_common_name: z.string().nullable().optional(),
    iconic_taxon_name: z.string().nullable().optional(),
    rank: z.string().nullable().optional(),
    ancestry: z.string().nullable().optional(),
    wikipedia_url: z.string().nullable().optional(),
    observations_count: z.number().nullable().optional(),
    default_photo: z
      .object({
        medium_url: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const InatUserSchema = z
  .object({
    id: z.number(),
    login: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    observations_count: z.number().nullable().optional(),
    species_count: z.number().nullable().optional(),
  })
  .passthrough();

const InatPhotoSchema = z
  .object({
    url: z.string().nullable().optional(),
  })
  .passthrough();

export const InatObservationSchema = z
  .object({
    id: z.number(),
    species_guess: z.string().nullable().optional(),
    taxon: InatTaxonSchema.nullable().optional(),
    observed_on: z.string().nullable().optional(),
    observed_on_string: z.string().nullable().optional(),
    time_observed_at: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    place_guess: z.string().nullable().optional(),
    quality_grade: z.string().nullable().optional(),
    photos: z.array(InatPhotoSchema).nullable().optional(),
    user: InatUserSchema.nullable().optional(),
    created_at: z.string().nullable().optional(),
    uri: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    identifications_count: z.number().nullable().optional(),
    comments_count: z.number().nullable().optional(),
  })
  .passthrough();

export const InatPaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      total_results: z.number(),
      page: z.number(),
      per_page: z.number(),
      results: z.array(item),
    })
    .passthrough();

export const InatSpeciesCountResultSchema = z
  .object({
    count: z.number(),
    taxon: InatTaxonSchema,
  })
  .passthrough();

export const InatPlaceSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    display_name: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    bounding_box_geojson: z
      .object({
        type: z.string(),
        coordinates: z.array(z.array(z.array(z.number()))),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const InatObserverResultSchema = z
  .object({
    user_id: z.number(),
    user: InatUserSchema,
    observation_count: z.number(),
    species_count: z.number(),
  })
  .passthrough();

export type InatTaxon = z.infer<typeof InatTaxonSchema>;
export type InatObservation = z.infer<typeof InatObservationSchema>;
export type InatSpeciesCountResult = z.infer<typeof InatSpeciesCountResultSchema>;
export type InatPlace = z.infer<typeof InatPlaceSchema>;
export type InatObserverResult = z.infer<typeof InatObserverResultSchema>;
export { InatTaxonSchema, InatUserSchema };
