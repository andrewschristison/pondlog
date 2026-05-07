import type { Observation, Place, Taxon } from "@pondlog/core";
import type {
  EbirdHotspot,
  EbirdHotspotInfo,
  EbirdObservation,
  EbirdTaxonomyEntry,
} from "./schemas.js";

function buildChecklistUrl(subId: string | undefined): string {
  if (!subId) return "https://ebird.org";
  return `https://ebird.org/checklist/${subId}`;
}

export function normalizeObservation(raw: EbirdObservation): Observation {
  const observation: Observation = {
    id: raw.subId ? `${raw.subId}:${raw.speciesCode}` : `${raw.locId}:${raw.speciesCode}:${raw.obsDt}`,
    source: "ebird",
    taxonName: raw.sciName,
    commonName: raw.comName,
    iconicTaxon: "Aves",
    observedAt: raw.obsDt,
    coordinates: { lat: raw.lat, lng: raw.lng },
    placeGuess: raw.locName,
    observerName: raw.userDisplayName ?? "unknown",
    url: buildChecklistUrl(raw.subId),
  };
  if (raw.obsValid !== undefined) {
    observation.qualityGrade = raw.obsValid ? "valid" : "unconfirmed";
  }
  return observation;
}

export function normalizeHotspot(raw: EbirdHotspot): Place {
  return {
    id: raw.locId,
    name: raw.locName,
    displayName: raw.locName,
    source: "ebird",
    coordinates: { lat: raw.lat, lng: raw.lng },
  };
}

export function normalizeHotspotInfo(raw: EbirdHotspotInfo): Place {
  const lat = raw.latitude ?? raw.lat ?? 0;
  const lng = raw.longitude ?? raw.lng ?? 0;
  const name = raw.name ?? raw.locName ?? raw.locId;
  const place: Place = {
    id: raw.locId ?? raw.locID ?? "",
    name,
    displayName: raw.hierarchicalName ?? name,
    source: "ebird",
    coordinates: { lat, lng },
  };
  return place;
}

export function normalizeTaxonomyEntry(raw: EbirdTaxonomyEntry): Taxon {
  return {
    id: raw.speciesCode,
    name: raw.sciName,
    commonName: raw.comName,
    rank: raw.category,
    iconicTaxon: "Aves",
    source: "ebird",
  };
}
