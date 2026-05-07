import { z } from "zod";

// NPN encodes "no value" as the integer -9999 across many fields. We accept
// it on the wire and translate in normalize.ts so consumers never see it.
const NumOrSentinel = z.number();
const StrOrEmpty = z.string();

const NpnSpeciesTypeSchema = z
  .object({
    Species_Type_ID: z.number(),
    Species_Type: z.string(),
    Comment: z.string().nullable().optional(),
    User_Display: z.union([z.number(), z.string()]).nullable().optional(),
    Kingdom: z.string().nullable().optional(),
    Image_Path: z.string().nullable().optional(),
  })
  .passthrough();

export const NpnSpeciesSchema = z
  .object({
    species_id: z.number(),
    common_name: StrOrEmpty.nullable().optional(),
    genus: StrOrEmpty.nullable().optional(),
    genus_id: z.number().nullable().optional(),
    genus_common_name: StrOrEmpty.nullable().optional(),
    species: StrOrEmpty.nullable().optional(),
    kingdom: StrOrEmpty.nullable().optional(),
    itis_taxonomic_sn: NumOrSentinel.nullable().optional(),
    functional_type: StrOrEmpty.nullable().optional(),
    class_id: z.number().nullable().optional(),
    class_common_name: StrOrEmpty.nullable().optional(),
    class_name: StrOrEmpty.nullable().optional(),
    order_id: z.number().nullable().optional(),
    order_common_name: StrOrEmpty.nullable().optional(),
    order_name: StrOrEmpty.nullable().optional(),
    family_id: z.number().nullable().optional(),
    family_name: StrOrEmpty.nullable().optional(),
    family_common_name: StrOrEmpty.nullable().optional(),
    species_type: z.array(NpnSpeciesTypeSchema).nullable().optional(),
  })
  .passthrough();

export const NpnStationSchema = z
  .object({
    station_id: z.number(),
    // station_name occasionally arrives as a number (e.g. an integer "name").
    station_name: z.union([z.string(), z.number()]).nullable().optional(),
    latitude: z.number(),
    longitude: z.number(),
    network_id: z.union([z.string(), z.number()]).nullable().optional(),
    file_url: StrOrEmpty.nullable().optional(),
  })
  .passthrough();

export const NpnStationsByLocationErrorShape = z
  .object({
    stations: z.union([z.string(), z.array(z.unknown())]),
    response_messages: z.string(),
  })
  .passthrough();

export const NpnStationCountByStateSchema = z
  .object({
    // Some stations have no state assigned; the API returns state=null for that bucket.
    state: z.string().nullable(),
    number_stations: z.union([z.number(), z.string()]),
  })
  .passthrough();

export const NpnObservationSchema = z
  .object({
    observation_id: z.number(),
    update_datetime: z.union([z.number(), z.string()]).nullable().optional(),
    site_id: z.number().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    elevation_in_meters: z.number().nullable().optional(),
    state: StrOrEmpty.nullable().optional(),
    species_id: z.number(),
    genus: StrOrEmpty.nullable().optional(),
    species: StrOrEmpty.nullable().optional(),
    common_name: StrOrEmpty.nullable().optional(),
    kingdom: StrOrEmpty.nullable().optional(),
    individual_id: z.number().nullable().optional(),
    phenophase_id: z.number().nullable().optional(),
    phenophase_description: StrOrEmpty.nullable().optional(),
    observation_date: StrOrEmpty.nullable().optional(),
    day_of_year: z.number().nullable().optional(),
    // -1 (uncertain), 0 (no), 1 (yes)
    phenophase_status: z.number(),
    intensity_category_id: z.number().nullable().optional(),
    intensity_value: z.union([z.number(), z.string()]).nullable().optional(),
    abundance_value: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .passthrough();

export const NpnSiteLevelDataSchema = z
  .object({
    site_id: z.number(),
    site_name: z.union([z.string(), z.number()]).nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    elevation_in_meters: z.number().nullable().optional(),
    state: z.union([z.string(), z.number()]).nullable().optional(),
    species_id: z.number(),
    genus: StrOrEmpty.nullable().optional(),
    species: StrOrEmpty.nullable().optional(),
    common_name: StrOrEmpty.nullable().optional(),
    kingdom: StrOrEmpty.nullable().optional(),
    phenophase_id: z.number().nullable().optional(),
    phenophase_description: StrOrEmpty.nullable().optional(),
    // Phenometric aggregates returned by getSiteLevelData.json:
    first_yes_sample_size: z.number().nullable().optional(),
    mean_first_yes_year: z.number().nullable().optional(),
    mean_first_yes_doy: z.number().nullable().optional(),
    mean_first_yes_julian_date: z.number().nullable().optional(),
    se_first_yes_in_days: z.number().nullable().optional(),
    mean_numdays_since_prior_no: z.number().nullable().optional(),
    se_numdays_since_prior_no: z.number().nullable().optional(),
    last_yes_sample_size: z.number().nullable().optional(),
    mean_last_yes_year: z.number().nullable().optional(),
    mean_last_yes_doy: z.number().nullable().optional(),
    mean_last_yes_julian_date: z.number().nullable().optional(),
    se_last_yes_in_days: z.number().nullable().optional(),
    mean_numdays_until_next_no: z.number().nullable().optional(),
    se_numdays_until_next_no: z.number().nullable().optional(),
  })
  .passthrough();

export type NpnSpecies = z.infer<typeof NpnSpeciesSchema>;
export type NpnStation = z.infer<typeof NpnStationSchema>;
export type NpnStationCountByState = z.infer<typeof NpnStationCountByStateSchema>;
export type NpnObservation = z.infer<typeof NpnObservationSchema>;
export type NpnSiteLevelData = z.infer<typeof NpnSiteLevelDataSchema>;
