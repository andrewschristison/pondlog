import { z } from "zod";

// MO returns numeric strings for some lat/lng fields and embedded location
// boundaries. We accept either form and normalize downstream.
const NumOrNumString = z.union([z.number(), z.string()]).nullable().optional();

const MoOwner = z
  .object({
    id: z.number(),
    login_name: z.string().nullable().optional(),
    legal_name: z.string().nullable().optional(),
  })
  .passthrough();

const MoConsensus = z
  .object({
    id: z.number(),
    name: z.string(),
    author: z.string().nullable().optional(),
    rank: z.string().nullable().optional(),
    synonym_id: z.number().nullable().optional(),
  })
  .passthrough();

const MoNamingReason = z
  .object({
    reason: z.string(),
    notes: z.string().nullable().optional(),
  })
  .passthrough();

const MoNaming = z
  .object({
    id: z.number(),
    // The nested `name` on a naming has the same general shape as MoConsensus.
    name: MoConsensus,
    owner: MoOwner.nullable().optional(),
    confidence: z.number(),
    reasons: z.array(MoNamingReason).nullable().optional(),
  })
  .passthrough();

const MoVote = z
  .object({
    id: z.number(),
    confidence: z.number(),
    naming_id: z.number().nullable().optional(),
    owner: MoOwner.nullable().optional(),
  })
  .passthrough();

const MoImage = z
  .object({
    id: z.number(),
    date: z.string().nullable().optional(),
    license: z.string().nullable().optional(),
    owner: MoOwner.nullable().optional(),
    copyright_holder: z.string().nullable().optional(),
    original_url: z.string().nullable().optional(),
  })
  .passthrough();

const MoComment = z
  .object({
    id: z.number(),
    summary: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    owner: MoOwner.nullable().optional(),
  })
  .passthrough();

export const MoLocationEmbeddedSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    latitude_north: NumOrNumString,
    latitude_south: NumOrNumString,
    longitude_east: NumOrNumString,
    longitude_west: NumOrNumString,
  })
  .passthrough();

export const MoLocationSchema = z
  .object({
    id: z.number(),
    type: z.literal("location").nullable().optional(),
    name: z.string(),
    latitude_north: NumOrNumString,
    latitude_south: NumOrNumString,
    longitude_east: NumOrNumString,
    longitude_west: NumOrNumString,
    high: NumOrNumString,
    low: NumOrNumString,
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

/** Observation shape covering both detail=low (flat IDs) and detail=high
 *  (nested objects). All fields are optional/nullable so we don't reject
 *  records that the high-detail API decided to omit. */
export const MoObservationSchema = z
  .object({
    id: z.number(),
    type: z.literal("observation").nullable().optional(),
    date: z.string().nullable().optional(),
    latitude: NumOrNumString,
    longitude: NumOrNumString,
    altitude: NumOrNumString,
    gps_hidden: z.boolean().nullable().optional(),
    specimen_available: z.boolean().nullable().optional(),
    is_collection_location: z.boolean().nullable().optional(),
    confidence: z.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    number_of_views: z.number().nullable().optional(),
    last_viewed: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),

    // detail=low (flat references)
    owner_id: z.number().nullable().optional(),
    consensus_id: z.number().nullable().optional(),
    consensus_name: z.string().nullable().optional(),
    location_id: z.number().nullable().optional(),
    location_name: z.string().nullable().optional(),
    primary_image_id: z.number().nullable().optional(),

    // detail=high (nested objects)
    owner: MoOwner.nullable().optional(),
    consensus: MoConsensus.nullable().optional(),
    namings: z.array(MoNaming).nullable().optional(),
    votes: z.array(MoVote).nullable().optional(),
    location: MoLocationEmbeddedSchema.nullable().optional(),
    primary_image: MoImage.nullable().optional(),
    images: z.array(MoImage).nullable().optional(),
    comments: z.array(MoComment).nullable().optional(),
  })
  .passthrough();

const MoNameParent = z
  .object({
    id: z.number().nullable().optional(),
    name: z.string(),
    rank: z.string().nullable().optional(),
  })
  .passthrough();

export const MoNameSchema = z
  .object({
    id: z.number(),
    type: z.literal("name").nullable().optional(),
    name: z.string(),
    author: z.string().nullable().optional(),
    rank: z.string().nullable().optional(),
    deprecated: z.boolean().nullable().optional(),
    misspelled: z.boolean().nullable().optional(),
    citation: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    number_of_views: z.number().nullable().optional(),
    last_viewed: z.string().nullable().optional(),
    ok_for_export: z.boolean().nullable().optional(),
    parents: z.array(MoNameParent).nullable().optional(),
    synonym_id: z.number().nullable().optional(),
  })
  .passthrough();

/** The shared MO API2 envelope. */
export function MoEnvelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      version: z.union([z.string(), z.number()]).nullable().optional(),
      run_date: z.string().nullable().optional(),
      query: z.string().nullable().optional(),
      number_of_records: z.number().nullable().optional(),
      number_of_pages: z.number().nullable().optional(),
      page_number: z.number().nullable().optional(),
      results: z.array(item).default([]),
      run_time: z.number().nullable().optional(),
      errors: z
        .array(
          z
            .object({
              code: z.string().nullable().optional(),
              details: z.string().nullable().optional(),
              fatal: z.boolean().nullable().optional(),
            })
            .passthrough(),
        )
        .nullable()
        .optional(),
    })
    .passthrough();
}

export const MoObservationEnvelope = MoEnvelopeSchema(MoObservationSchema);
export const MoNameEnvelope = MoEnvelopeSchema(MoNameSchema);
export const MoLocationEnvelope = MoEnvelopeSchema(MoLocationSchema);

export type MoObservation = z.infer<typeof MoObservationSchema>;
export type MoName = z.infer<typeof MoNameSchema>;
export type MoLocation = z.infer<typeof MoLocationSchema>;
export type MoLocationEmbedded = z.infer<typeof MoLocationEmbeddedSchema>;
