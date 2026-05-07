import {
  err,
  ok,
  type Coordinates,
  type IconicTaxaSummary,
  type IconicTaxon,
  type Observation,
  type ObservationDetail,
  type Observer,
  type Place,
  type Result,
  type SpeciesCount,
  type Taxon,
  type TaxonDetail,
} from "@pondlog/core";
import { z } from "zod";
import { inatFetch } from "./client.js";
import {
  normalizeObservation,
  normalizeObservationDetail,
  normalizeObserver,
  normalizePlace,
  normalizeSpeciesCount,
  normalizeTaxon,
  normalizeTaxonDetail,
} from "./normalize.js";
import {
  InatObservationSchema,
  InatObserverResultSchema,
  InatPaginatedSchema,
  InatPlaceSchema,
  InatSpeciesCountResultSchema,
  InatTaxonSchema,
} from "./schemas.js";

const DEFAULT_RADIUS_KM = 25;
const DEFAULT_DAYS = 7;
const MAX_PER_PAGE = 200;

const ObservationsResponse = InatPaginatedSchema(InatObservationSchema);
const SingleObservationResponse = InatPaginatedSchema(InatObservationSchema);
const SpeciesCountsResponse = InatPaginatedSchema(InatSpeciesCountResultSchema);
const TaxaResponse = InatPaginatedSchema(InatTaxonSchema);
const ObserversResponse = InatPaginatedSchema(InatObserverResultSchema);

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface SearchObservationsParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  taxonId?: number;
  taxonName?: string;
  iconicTaxa?: IconicTaxon[];
  d1?: string;
  d2?: string;
  qualityGrade?: "research" | "needs_id" | "casual";
  orderBy?: "created_at" | "observed_on" | "species_guess" | "votes" | "id";
  perPage?: number;
  page?: number;
  placeId?: number;
  locale?: string;
}

export async function searchObservations(
  params: SearchObservationsParams = {},
): Promise<Result<Observation[]>> {
  const sp: Record<string, string | number | undefined> = {
    lat: params.lat,
    lng: params.lng,
    radius: params.radiusKm,
    taxon_id: params.taxonId,
    taxon_name: params.taxonName,
    iconic_taxa: params.iconicTaxa?.join(","),
    d1: params.d1,
    d2: params.d2,
    quality_grade: params.qualityGrade,
    order_by: params.orderBy,
    per_page: params.perPage ?? 30,
    page: params.page,
    place_id: params.placeId,
    locale: params.locale ?? "en",
  };
  const result = await inatFetch("/observations", ObservationsResponse, { searchParams: sp });
  if (!result.ok) return result;
  return ok(result.data.results.map(normalizeObservation));
}

export async function getObservation(id: number | string): Promise<Result<ObservationDetail>> {
  const result = await inatFetch(`/observations/${id}`, SingleObservationResponse);
  if (!result.ok) return result;
  const first = result.data.results[0];
  if (!first) {
    return err({
      source: "inaturalist",
      message: `Observation ${id} not found`,
      statusCode: 404,
    });
  }
  return ok(normalizeObservationDetail(first));
}

export interface GetSpeciesCountsParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  iconicTaxa?: IconicTaxon[];
  d1?: string;
  d2?: string;
  perPage?: number;
  page?: number;
  placeId?: number;
  locale?: string;
}

export async function getSpeciesCounts(
  params: GetSpeciesCountsParams = {},
): Promise<Result<SpeciesCount[]>> {
  const sp: Record<string, string | number | undefined> = {
    lat: params.lat,
    lng: params.lng,
    radius: params.radiusKm,
    iconic_taxa: params.iconicTaxa?.join(","),
    d1: params.d1,
    d2: params.d2,
    per_page: params.perPage ?? 100,
    page: params.page,
    place_id: params.placeId,
    locale: params.locale ?? "en",
  };
  const result = await inatFetch(
    "/observations/species_counts",
    SpeciesCountsResponse,
    { searchParams: sp },
  );
  if (!result.ok) return result;
  return ok(result.data.results.map(normalizeSpeciesCount));
}

export async function getNearbyObservations(
  coords: Coordinates,
  radiusKm: number = DEFAULT_RADIUS_KM,
  days: number = DEFAULT_DAYS,
): Promise<Result<Observation[]>> {
  return searchObservations({
    lat: coords.lat,
    lng: coords.lng,
    radiusKm,
    d1: isoDaysAgo(days),
    orderBy: "observed_on",
    perPage: 50,
  });
}

export async function searchTaxa(query: string): Promise<Result<Taxon[]>> {
  if (!query.trim()) {
    return err({ source: "inaturalist", message: "searchTaxa: query is empty" });
  }
  const result = await inatFetch("/taxa", TaxaResponse, {
    searchParams: { q: query, is_active: "true", per_page: 30 },
  });
  if (!result.ok) return result;
  return ok(result.data.results.map(normalizeTaxon));
}

export async function getTaxon(id: number | string): Promise<Result<TaxonDetail>> {
  const result = await inatFetch(`/taxa/${id}`, TaxaResponse);
  if (!result.ok) return result;
  const first = result.data.results[0];
  if (!first) {
    return err({
      source: "inaturalist",
      message: `Taxon ${id} not found`,
      statusCode: 404,
    });
  }
  return ok(normalizeTaxonDetail(first));
}

const ICONIC_GROUPS: IconicTaxon[] = [
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
];

export async function getIconicTaxaSummary(
  coords: Coordinates,
  radiusKm: number = DEFAULT_RADIUS_KM,
  days: number = DEFAULT_DAYS,
): Promise<Result<IconicTaxaSummary>> {
  const result = await getSpeciesCounts({
    lat: coords.lat,
    lng: coords.lng,
    radiusKm,
    d1: isoDaysAgo(days),
    perPage: MAX_PER_PAGE,
  });
  if (!result.ok) return result;

  const totals = createIconicMap();
  const topPerGroup = createIconicListMap();

  for (const sc of result.data) {
    totals[sc.iconicTaxon] = (totals[sc.iconicTaxon] ?? 0) + sc.count;
    const list = topPerGroup[sc.iconicTaxon] ?? [];
    if (list.length < 5) list.push(sc);
    topPerGroup[sc.iconicTaxon] = list;
  }

  return ok({ coordinates: coords, radiusKm, days, totals, topPerGroup });
}

function createIconicMap(): Record<IconicTaxon, number> {
  const all: IconicTaxon[] = [...ICONIC_GROUPS, "Unknown", "Animalia", "Protozoa", "Chromista"];
  const map = {} as Record<IconicTaxon, number>;
  for (const k of all) map[k] = 0;
  return map;
}

function createIconicListMap(): Record<IconicTaxon, SpeciesCount[]> {
  const all: IconicTaxon[] = [...ICONIC_GROUPS, "Unknown", "Animalia", "Protozoa", "Chromista"];
  const map = {} as Record<IconicTaxon, SpeciesCount[]>;
  for (const k of all) map[k] = [];
  return map;
}

const PlaceAutocompleteResponse = z
  .object({
    total_results: z.number(),
    page: z.number().optional(),
    per_page: z.number().optional(),
    results: z.array(InatPlaceSchema),
  })
  .passthrough();

export async function searchPlaces(query: string): Promise<Result<Place[]>> {
  if (!query.trim()) {
    return err({ source: "inaturalist", message: "searchPlaces: query is empty" });
  }
  const result = await inatFetch("/places/autocomplete", PlaceAutocompleteResponse, {
    searchParams: { q: query, per_page: 10 },
  });
  if (!result.ok) return result;
  return ok(result.data.results.map(normalizePlace));
}

export async function getObservers(
  coords: Coordinates,
  radiusKm: number = DEFAULT_RADIUS_KM,
  days: number = DEFAULT_DAYS,
): Promise<Result<Observer[]>> {
  const sp: Record<string, string | number | undefined> = {
    lat: coords.lat,
    lng: coords.lng,
    radius: radiusKm,
    d1: isoDaysAgo(days),
    per_page: 30,
  };
  const result = await inatFetch("/observations/observers", ObserversResponse, {
    searchParams: sp,
  });
  if (!result.ok) return result;
  return ok(result.data.results.map(normalizeObserver));
}
