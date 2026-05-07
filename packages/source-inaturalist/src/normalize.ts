import {
  parseLatLngString,
  type IconicTaxon,
  type Observation,
  type ObservationDetail,
  type Observer,
  type Place,
  type SpeciesCount,
  type Taxon,
  type TaxonDetail,
} from "@pondlog/core";
import type {
  InatObservation,
  InatObserverResult,
  InatPlace,
  InatSpeciesCountResult,
  InatTaxon,
} from "./schemas.js";

const ICONIC_TAXA: ReadonlySet<IconicTaxon> = new Set([
  "Aves",
  "Amphibia",
  "Mammalia",
  "Reptilia",
  "Insecta",
  "Arachnida",
  "Mollusca",
  "Plantae",
  "Fungi",
  "Protozoa",
  "Chromista",
  "Animalia",
  "Actinopterygii",
  "Unknown",
]);

function normalizeIconicTaxon(name: string | null | undefined): IconicTaxon {
  if (!name) return "Unknown";
  return ICONIC_TAXA.has(name as IconicTaxon) ? (name as IconicTaxon) : "Unknown";
}

function buildObservationUrl(id: number): string {
  return `https://www.inaturalist.org/observations/${id}`;
}

function pickObservedAt(raw: InatObservation): string {
  return (
    raw.time_observed_at ??
    raw.observed_on ??
    raw.observed_on_string ??
    raw.created_at ??
    ""
  );
}

function pickObserverName(raw: InatObservation): string {
  const user = raw.user;
  if (!user) return "unknown";
  return firstNonEmpty(user.name, user.login) ?? "unknown";
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

function pickTaxonName(raw: InatObservation): string {
  return raw.taxon?.name ?? raw.species_guess ?? "Unknown";
}

function pickCommonName(raw: InatObservation): string {
  return (
    raw.taxon?.preferred_common_name ??
    raw.species_guess ??
    raw.taxon?.name ??
    "Unknown"
  );
}

export function normalizeObservation(raw: InatObservation): Observation {
  const observation: Observation = {
    id: String(raw.id),
    source: "inaturalist",
    taxonName: pickTaxonName(raw),
    commonName: pickCommonName(raw),
    iconicTaxon: normalizeIconicTaxon(raw.taxon?.iconic_taxon_name ?? null),
    observedAt: pickObservedAt(raw),
    coordinates: parseLatLngString(raw.location ?? null),
    placeGuess: raw.place_guess ?? "",
    observerName: pickObserverName(raw),
    url: raw.uri ?? buildObservationUrl(raw.id),
  };
  if (raw.quality_grade) {
    observation.qualityGrade = raw.quality_grade;
  }
  return observation;
}

export function normalizeObservationDetail(raw: InatObservation): ObservationDetail {
  const base = normalizeObservation(raw);
  const photoUrls = (raw.photos ?? [])
    .map((p) => p.url ?? null)
    .filter((u): u is string => typeof u === "string");
  const detail: ObservationDetail = { ...base, photoUrls };
  if (raw.description) detail.description = raw.description;
  if (typeof raw.identifications_count === "number") {
    detail.identificationsCount = raw.identifications_count;
  }
  if (typeof raw.comments_count === "number") {
    detail.commentsCount = raw.comments_count;
  }
  return detail;
}

export function normalizeSpeciesCount(raw: InatSpeciesCountResult): SpeciesCount {
  return {
    taxonName: raw.taxon.name ?? "Unknown",
    commonName:
      raw.taxon.preferred_common_name ?? raw.taxon.name ?? "Unknown",
    iconicTaxon: normalizeIconicTaxon(raw.taxon.iconic_taxon_name ?? null),
    count: raw.count,
    source: "inaturalist",
  };
}

export function normalizeTaxon(raw: InatTaxon): Taxon {
  return {
    id: String(raw.id),
    name: raw.name ?? "Unknown",
    commonName: raw.preferred_common_name ?? raw.name ?? "Unknown",
    rank: raw.rank ?? "unknown",
    iconicTaxon: normalizeIconicTaxon(raw.iconic_taxon_name ?? null),
    source: "inaturalist",
  };
}

export function normalizeTaxonDetail(raw: InatTaxon): TaxonDetail {
  const base = normalizeTaxon(raw);
  const detail: TaxonDetail = { ...base };
  if (raw.ancestry) detail.ancestry = raw.ancestry.split("/").filter(Boolean);
  if (raw.wikipedia_url) detail.wikipediaUrl = raw.wikipedia_url;
  if (typeof raw.observations_count === "number") {
    detail.observationsCount = raw.observations_count;
  }
  const photoUrl = raw.default_photo?.medium_url ?? raw.default_photo?.url;
  if (photoUrl) detail.defaultPhotoUrl = photoUrl;
  return detail;
}

export function normalizePlace(raw: InatPlace): Place {
  const place: Place = {
    id: String(raw.id),
    name: raw.name,
    displayName: raw.display_name ?? raw.name,
    source: "inaturalist",
  };
  const coords = parseLatLngString(raw.location ?? null);
  if (coords) place.coordinates = coords;
  return place;
}

export function normalizeObserver(raw: InatObserverResult): Observer {
  const user = raw.user;
  return {
    id: String(raw.user_id),
    loginName: user.login ?? String(raw.user_id),
    displayName: user.name ?? user.login ?? String(raw.user_id),
    observationCount: raw.observation_count,
    speciesCount: raw.species_count,
    source: "inaturalist",
  };
}
