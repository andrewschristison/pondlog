import { z } from "zod";

// USGS Water Services returns WaterML-translated JSON for /iv/ and /dv/.
// Many fields ride along that we don't strictly need; .passthrough() keeps
// them parsed-but-ignored so a future wire change doesn't break our reads.

const SiteCodeSchema = z
  .object({
    value: z.string(),
    network: z.string().optional(),
    agencyCode: z.string().optional(),
  })
  .passthrough();

const GeogLocationSchema = z
  .object({
    srs: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
  })
  .passthrough();

const GeoLocationSchema = z
  .object({
    geogLocation: GeogLocationSchema,
  })
  .passthrough();

const TimeZoneInnerSchema = z
  .object({
    zoneOffset: z.string().optional(),
    zoneAbbreviation: z.string().optional(),
  })
  .passthrough();

const TimeZoneInfoSchema = z
  .object({
    defaultTimeZone: TimeZoneInnerSchema.optional(),
    daylightSavingsTimeZone: TimeZoneInnerSchema.optional(),
    siteUsesDaylightSavingsTime: z.boolean().optional(),
  })
  .passthrough();

const SitePropertySchema = z
  .object({
    value: z.union([z.string(), z.number()]).nullable().optional(),
    name: z.string(),
  })
  .passthrough();

export const UsgsSourceInfoSchema = z
  .object({
    siteName: z.string(),
    siteCode: z.array(SiteCodeSchema).min(1),
    timeZoneInfo: TimeZoneInfoSchema.optional(),
    geoLocation: GeoLocationSchema,
    siteProperty: z.array(SitePropertySchema).optional(),
  })
  .passthrough();

const VariableCodeSchema = z
  .object({
    value: z.string(),
    network: z.string().optional(),
    vocabulary: z.string().optional(),
    variableID: z.number().optional(),
    default: z.boolean().optional(),
  })
  .passthrough();

const UnitSchema = z
  .object({
    unitCode: z.string(),
  })
  .passthrough();

const VariableOptionSchema = z
  .object({
    value: z.string().optional(),
    name: z.string().optional(),
    optionCode: z.string().optional(),
  })
  .passthrough();

const VariableOptionsSchema = z
  .object({
    option: z.array(VariableOptionSchema).optional(),
  })
  .passthrough();

export const UsgsVariableSchema = z
  .object({
    variableCode: z.array(VariableCodeSchema).min(1),
    variableName: z.string(),
    variableDescription: z.string().optional(),
    valueType: z.string().optional(),
    unit: UnitSchema,
    options: VariableOptionsSchema.optional(),
    // -999999.0 in real responses; accept any number so we don't fail on drift.
    noDataValue: z.number().optional(),
  })
  .passthrough();

export const UsgsValueSchema = z
  .object({
    value: z.string(),
    qualifiers: z.array(z.string()).optional(),
    dateTime: z.string(),
  })
  .passthrough();

const UsgsQualifierSchema = z
  .object({
    qualifierCode: z.string(),
    qualifierDescription: z.string().optional(),
  })
  .passthrough();

const UsgsMethodSchema = z
  .object({
    methodDescription: z.string().optional(),
    methodID: z.number().optional(),
  })
  .passthrough();

export const UsgsValueGroupSchema = z
  .object({
    value: z.array(UsgsValueSchema),
    qualifier: z.array(UsgsQualifierSchema).optional(),
    method: z.array(UsgsMethodSchema).optional(),
  })
  .passthrough();

export const UsgsTimeSeriesSchema = z
  .object({
    sourceInfo: UsgsSourceInfoSchema,
    variable: UsgsVariableSchema,
    values: z.array(UsgsValueGroupSchema),
    name: z.string(),
  })
  .passthrough();

export const UsgsResponseSchema = z
  .object({
    name: z.string().optional(),
    value: z
      .object({
        queryInfo: z.unknown().optional(),
        timeSeries: z.array(UsgsTimeSeriesSchema),
      })
      .passthrough(),
  })
  .passthrough();

export type UsgsTimeSeries = z.infer<typeof UsgsTimeSeriesSchema>;
export type UsgsValueGroup = z.infer<typeof UsgsValueGroupSchema>;
export type UsgsValue = z.infer<typeof UsgsValueSchema>;
export type UsgsResponse = z.infer<typeof UsgsResponseSchema>;
