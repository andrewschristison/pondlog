import { z } from "zod";

// ---------- Observations ----------

export const EbirdObservationSchema = z
  .object({
    speciesCode: z.string(),
    comName: z.string(),
    sciName: z.string(),
    locId: z.string(),
    locName: z.string(),
    obsDt: z.string(),
    howMany: z.number().nullable().optional(),
    lat: z.number(),
    lng: z.number(),
    obsValid: z.boolean().optional(),
    obsReviewed: z.boolean().optional(),
    locationPrivate: z.boolean().optional(),
    subId: z.string().optional(),
    subnational1Code: z.string().optional(),
    subnational1Name: z.string().optional(),
    countryCode: z.string().optional(),
    countryName: z.string().optional(),
    userDisplayName: z.string().optional(),
    numObservers: z.number().optional(),
    hasComments: z.boolean().optional(),
    hasRichMedia: z.boolean().optional(),
  })
  .passthrough();

export const EbirdObservationListSchema = z.array(EbirdObservationSchema);

// ---------- Product: Checklists ----------

export const EbirdChecklistSummarySchema = z
  .object({
    locId: z.string(),
    subId: z.string(),
    userDisplayName: z.string().optional(),
    numSpecies: z.number().optional(),
    obsDt: z.string(),
    obsTime: z.string().optional(),
    isoObsDate: z.string().optional(),
    subID: z.string().optional(),
  })
  .passthrough();

export const EbirdChecklistSummaryListSchema = z.array(EbirdChecklistSummarySchema);

export const EbirdChecklistObservationSchema = z
  .object({
    speciesCode: z.string(),
    hideFlags: z.array(z.string()).optional(),
    obsDt: z.string().optional(),
    subnational1Code: z.string().optional(),
    howManyAtleast: z.number().optional(),
    howManyAtmost: z.number().optional(),
    howManyStr: z.string().optional(),
    present: z.boolean().optional(),
    projId: z.string().optional(),
    obsId: z.string().optional(),
  })
  .passthrough();

export const EbirdChecklistDetailSchema = z
  .object({
    projId: z.string().optional(),
    subId: z.string(),
    protocolId: z.string().optional(),
    locId: z.string(),
    groupId: z.string().optional(),
    durationHrs: z.number().nullable().optional(),
    allObsReported: z.boolean().optional(),
    creationDt: z.string().optional(),
    lastEditedDt: z.string().optional(),
    obsDt: z.string(),
    obsTimeValid: z.boolean().optional(),
    checklistId: z.string().optional(),
    numObservers: z.number().optional(),
    numSpecies: z.number().optional(),
    effortDistanceKm: z.number().optional(),
    effortAreaHa: z.number().optional(),
    submissionMethodCode: z.string().optional(),
    userDisplayName: z.string().optional(),
    obs: z.array(EbirdChecklistObservationSchema).optional(),
  })
  .passthrough();

// ---------- Product: Top 100 ----------

export const EbirdTop100EntrySchema = z
  .object({
    profileHandle: z.string().optional(),
    userDisplayName: z.string(),
    numSpecies: z.number(),
    numCompleteChecklists: z.number().optional(),
    rowNum: z.number().optional(),
    userId: z.string().optional(),
  })
  .passthrough();

export const EbirdTop100ListSchema = z.array(EbirdTop100EntrySchema);

// ---------- Hotspots ----------

export const EbirdHotspotSchema = z
  .object({
    locId: z.string(),
    locName: z.string(),
    countryCode: z.string().optional(),
    subnational1Code: z.string().optional(),
    subnational2Code: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    latestObsDt: z.string().nullable().optional(),
    numSpeciesAllTime: z.number().nullable().optional(),
  })
  .passthrough();

export const EbirdHotspotListSchema = z.array(EbirdHotspotSchema);

export const EbirdHotspotInfoSchema = z
  .object({
    locId: z.string(),
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    countryCode: z.string().optional(),
    countryName: z.string().optional(),
    subnational1Name: z.string().optional(),
    subnational1Code: z.string().optional(),
    subnational2Code: z.string().optional(),
    subnational2Name: z.string().optional(),
    isHotspot: z.boolean().optional(),
    locName: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    hierarchicalName: z.string().optional(),
    locID: z.string().optional(),
  })
  .passthrough();

// ---------- Taxonomy ----------

export const EbirdTaxonomyEntrySchema = z
  .object({
    sciName: z.string(),
    comName: z.string(),
    speciesCode: z.string(),
    category: z.string(),
    taxonOrder: z.number(),
    bandingCodes: z.array(z.string()).optional(),
    comNameCodes: z.array(z.string()).optional(),
    sciNameCodes: z.array(z.string()).optional(),
    order: z.string().optional(),
    familyCode: z.string().optional(),
    familyComName: z.string().optional(),
    familySciName: z.string().optional(),
    reportAs: z.string().optional(),
    extinct: z.boolean().optional(),
    extinctYear: z.number().optional(),
  })
  .passthrough();

export const EbirdTaxonomyListSchema = z.array(EbirdTaxonomyEntrySchema);

export const EbirdTaxonomicFormSchema = z
  .object({
    speciesCode: z.string(),
    forms: z.array(z.string()),
  })
  .passthrough();

export const EbirdTaxaLocaleSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    lastUpdate: z.string().optional(),
  })
  .passthrough();

export const EbirdTaxaLocaleListSchema = z.array(EbirdTaxaLocaleSchema);

export const EbirdTaxonomyVersionSchema = z
  .object({
    authorityVer: z.number(),
    latest: z.boolean().optional(),
  })
  .passthrough();

export const EbirdTaxonomyVersionListSchema = z.array(EbirdTaxonomyVersionSchema);

export const EbirdTaxonomicGroupSchema = z
  .object({
    groupName: z.string(),
    groupOrder: z.number().optional(),
    taxOrderBounds: z.array(z.array(z.number())).optional(),
  })
  .passthrough();

export const EbirdTaxonomicGroupListSchema = z.array(EbirdTaxonomicGroupSchema);

// ---------- Regions ----------

export const EbirdRegionInfoSchema = z
  .object({
    bounds: z
      .object({
        minX: z.number(),
        maxX: z.number(),
        minY: z.number(),
        maxY: z.number(),
      })
      .optional(),
    result: z.string(),
    code: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export const EbirdSubRegionSchema = z
  .object({
    code: z.string(),
    name: z.string(),
  })
  .passthrough();

export const EbirdSubRegionListSchema = z.array(EbirdSubRegionSchema);

export const EbirdAdjacentRegionSchema = z
  .object({
    code: z.string(),
    name: z.string(),
  })
  .passthrough();

export const EbirdAdjacentRegionListSchema = z.array(EbirdAdjacentRegionSchema);

// ---------- Type exports ----------

export type EbirdObservation = z.infer<typeof EbirdObservationSchema>;
export type EbirdChecklistSummary = z.infer<typeof EbirdChecklistSummarySchema>;
export type EbirdChecklistDetail = z.infer<typeof EbirdChecklistDetailSchema>;
export type EbirdChecklistObservation = z.infer<typeof EbirdChecklistObservationSchema>;
export type EbirdTop100Entry = z.infer<typeof EbirdTop100EntrySchema>;
export type EbirdHotspot = z.infer<typeof EbirdHotspotSchema>;
export type EbirdHotspotInfo = z.infer<typeof EbirdHotspotInfoSchema>;
export type EbirdTaxonomyEntry = z.infer<typeof EbirdTaxonomyEntrySchema>;
export type EbirdTaxonomicForm = z.infer<typeof EbirdTaxonomicFormSchema>;
export type EbirdTaxaLocale = z.infer<typeof EbirdTaxaLocaleSchema>;
export type EbirdTaxonomyVersion = z.infer<typeof EbirdTaxonomyVersionSchema>;
export type EbirdTaxonomicGroup = z.infer<typeof EbirdTaxonomicGroupSchema>;
export type EbirdRegionInfo = z.infer<typeof EbirdRegionInfoSchema>;
export type EbirdSubRegion = z.infer<typeof EbirdSubRegionSchema>;
export type EbirdAdjacentRegion = z.infer<typeof EbirdAdjacentRegionSchema>;
