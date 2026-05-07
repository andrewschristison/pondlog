import type {
  Coordinates,
  IconicTaxon,
  Observation,
  Taxon,
} from "@pondlog/core";
import type {
  NpnObservation,
  NpnSiteLevelData,
  NpnSpecies,
  NpnStation,
} from "./schemas.js";

const SENTINEL = -9999;

/** NPN encodes "no value" as -9999. Translate to undefined for our domain types. */
export function denull<T extends number | string>(
  value: T | null | undefined,
): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && value === SENTINEL) return undefined;
  if (typeof value === "string" && value === "") return undefined;
  return value;
}

/** Map an NPN kingdom string to a pondlog IconicTaxon. NPN data is
 * overwhelmingly Plantae and Animalia; we keep the mapping conservative. */
export function kingdomToIconic(kingdom: string | null | undefined): IconicTaxon {
  if (!kingdom) return "Unknown";
  switch (kingdom) {
    case "Plantae":
      return "Plantae";
    case "Animalia":
      return "Animalia";
    case "Fungi":
      return "Fungi";
    case "Protozoa":
      return "Protozoa";
    case "Chromista":
      return "Chromista";
    default:
      return "Unknown";
  }
}

export interface NormalizedNpnObservation extends Observation {
  /** -1 (uncertain), 0 (no), 1 (yes). Pondlog "active phenology" filters to 1. */
  phenophaseStatus: number;
  phenophaseId?: number;
  phenophaseDescription?: string;
  speciesId: number;
  individualId?: number;
  siteId?: number;
  state?: string;
  elevationMeters?: number;
  intensityCategoryId?: number;
  intensityValue?: number | string;
  abundanceValue?: number | string;
  dayOfYear?: number;
}

function buildObservationUrl(observationId: number): string {
  return `https://www.usanpn.org/observations/${observationId}`;
}

function pickCoords(raw: NpnObservation): Coordinates | null {
  const lat = denull(raw.latitude);
  const lng = denull(raw.longitude);
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function pickTaxonName(raw: NpnObservation): string {
  const genus = denull(raw.genus);
  const species = denull(raw.species);
  if (typeof genus === "string" && typeof species === "string") {
    return `${genus} ${species}`;
  }
  return denull(raw.common_name) ?? "Unknown";
}

function pickCommonName(raw: NpnObservation): string {
  return (
    denull(raw.common_name) ??
    pickTaxonName(raw) ??
    "Unknown"
  );
}

export function normalizeObservation(raw: NpnObservation): NormalizedNpnObservation {
  const out: NormalizedNpnObservation = {
    id: String(raw.observation_id),
    source: "npn",
    taxonName: pickTaxonName(raw),
    commonName: pickCommonName(raw),
    iconicTaxon: kingdomToIconic(denull(raw.kingdom) ?? null),
    observedAt: denull(raw.observation_date) ?? "",
    coordinates: pickCoords(raw),
    placeGuess: denull(raw.state) ?? "",
    observerName: "USA-NPN",
    url: buildObservationUrl(raw.observation_id),
    phenophaseStatus: raw.phenophase_status,
    speciesId: raw.species_id,
  };

  const phenoId = denull(raw.phenophase_id);
  if (typeof phenoId === "number") out.phenophaseId = phenoId;
  const phenoDesc = denull(raw.phenophase_description);
  if (typeof phenoDesc === "string") out.phenophaseDescription = phenoDesc;
  const indivId = denull(raw.individual_id);
  if (typeof indivId === "number") out.individualId = indivId;
  const siteId = denull(raw.site_id);
  if (typeof siteId === "number") out.siteId = siteId;
  const state = denull(raw.state);
  if (typeof state === "string") out.state = state;
  const elevation = denull(raw.elevation_in_meters);
  if (typeof elevation === "number") out.elevationMeters = elevation;
  const intensityCat = denull(raw.intensity_category_id);
  if (typeof intensityCat === "number") out.intensityCategoryId = intensityCat;
  const intensityVal = denull(raw.intensity_value);
  if (intensityVal !== undefined) out.intensityValue = intensityVal;
  const abundance = denull(raw.abundance_value);
  if (abundance !== undefined) out.abundanceValue = abundance;
  const doy = denull(raw.day_of_year);
  if (typeof doy === "number") out.dayOfYear = doy;

  return out;
}

export function normalizeSpecies(raw: NpnSpecies): Taxon {
  const genus = denull(raw.genus);
  const species = denull(raw.species);
  const sci =
    typeof genus === "string" && typeof species === "string"
      ? `${genus} ${species}`
      : (denull(raw.common_name) ?? "Unknown");
  return {
    id: String(raw.species_id),
    name: sci,
    commonName: denull(raw.common_name) ?? sci,
    rank: typeof species === "string" ? "species" : "genus",
    iconicTaxon: kingdomToIconic(denull(raw.kingdom) ?? null),
    source: "npn",
  };
}

export interface NormalizedStation {
  id: string;
  name: string;
  coordinates: Coordinates;
  source: "npn";
  networkId?: string;
  fileUrl?: string;
}

export function normalizeStation(raw: NpnStation): NormalizedStation {
  const network = raw.network_id;
  const rawName = raw.station_name;
  // station_name can arrive as a number for some records.
  const name =
    typeof rawName === "string"
      ? rawName.length > 0
        ? rawName
        : `station-${raw.station_id}`
      : typeof rawName === "number"
        ? String(rawName)
        : `station-${raw.station_id}`;
  const out: NormalizedStation = {
    id: String(raw.station_id),
    name,
    coordinates: { lat: raw.latitude, lng: raw.longitude },
    source: "npn",
  };
  if (typeof network === "string" && network.length > 0) out.networkId = network;
  if (typeof network === "number") out.networkId = String(network);
  const fileUrl = denull(raw.file_url);
  if (typeof fileUrl === "string") out.fileUrl = fileUrl;
  return out;
}

export interface NormalizedSiteLevelData {
  siteId: number;
  siteName?: string;
  coordinates: Coordinates | null;
  state?: string;
  speciesId: number;
  taxonName: string;
  commonName: string;
  iconicTaxon: IconicTaxon;
  phenophaseId?: number;
  phenophaseDescription?: string;
  /** ISO date of mean first "yes" observation (when phenophase began on average across the queried years). */
  meanFirstYesDate?: string;
  /** ISO date of mean last "yes" observation. */
  meanLastYesDate?: string;
  meanFirstYesDoy?: number;
  meanLastYesDoy?: number;
  meanFirstYesJulian?: number;
  meanLastYesJulian?: number;
  firstYesSampleSize?: number;
  lastYesSampleSize?: number;
  source: "npn";
}

function julianToIso(julian: number): string | undefined {
  if (!Number.isFinite(julian)) return undefined;
  // Julian Day 0 = -4713-11-24 12:00 UTC. Convert by offsetting from the Unix epoch's JD.
  const JD_UNIX_EPOCH = 2440587.5;
  const ms = (julian - JD_UNIX_EPOCH) * 86_400_000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function normalizeSiteLevelData(raw: NpnSiteLevelData): NormalizedSiteLevelData {
  const lat = denull(raw.latitude);
  const lng = denull(raw.longitude);
  const coords =
    typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
  const genus = denull(raw.genus);
  const species = denull(raw.species);
  const sci =
    typeof genus === "string" && typeof species === "string"
      ? `${genus} ${species}`
      : (denull(raw.common_name) ?? "Unknown");

  const out: NormalizedSiteLevelData = {
    siteId: raw.site_id,
    coordinates: coords,
    speciesId: raw.species_id,
    taxonName: sci,
    commonName: denull(raw.common_name) ?? sci,
    iconicTaxon: kingdomToIconic(denull(raw.kingdom) ?? null),
    source: "npn",
  };

  const rawSiteName = raw.site_name;
  if (typeof rawSiteName === "string" && rawSiteName.length > 0) {
    out.siteName = rawSiteName;
  } else if (typeof rawSiteName === "number") {
    out.siteName = String(rawSiteName);
  }

  const rawState = raw.state;
  if (typeof rawState === "string" && rawState.length > 0) out.state = rawState;
  else if (typeof rawState === "number") out.state = String(rawState);
  const phenoId = denull(raw.phenophase_id);
  if (typeof phenoId === "number") out.phenophaseId = phenoId;
  const phenoDesc = denull(raw.phenophase_description);
  if (typeof phenoDesc === "string") out.phenophaseDescription = phenoDesc;

  const firstYesJd = denull(raw.mean_first_yes_julian_date);
  if (typeof firstYesJd === "number") {
    out.meanFirstYesJulian = firstYesJd;
    const iso = julianToIso(firstYesJd);
    if (iso) out.meanFirstYesDate = iso;
  }
  const lastYesJd = denull(raw.mean_last_yes_julian_date);
  if (typeof lastYesJd === "number") {
    out.meanLastYesJulian = lastYesJd;
    const iso = julianToIso(lastYesJd);
    if (iso) out.meanLastYesDate = iso;
  }
  const firstYesDoy = denull(raw.mean_first_yes_doy);
  if (typeof firstYesDoy === "number") out.meanFirstYesDoy = firstYesDoy;
  const lastYesDoy = denull(raw.mean_last_yes_doy);
  if (typeof lastYesDoy === "number") out.meanLastYesDoy = lastYesDoy;
  const firstYesN = denull(raw.first_yes_sample_size);
  if (typeof firstYesN === "number") out.firstYesSampleSize = firstYesN;
  const lastYesN = denull(raw.last_yes_sample_size);
  if (typeof lastYesN === "number") out.lastYesSampleSize = lastYesN;

  return out;
}
