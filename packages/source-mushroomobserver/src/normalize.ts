import type { Coordinates } from "@pondlog/core";
import type {
  MoLocation,
  MoLocationEmbedded,
  MoName,
  MoObservation,
} from "./schemas.js";

/** Strip basic HTML tags + decode common entities. MO returns notes as
 *  HTML-flavored strings; we don't run a full parser, just a cheap pass that
 *  is safe for terminal display and JSON consumers. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#215;/g, "×")
    .replace(/\s+/g, " ")
    .trim();
}

function num(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function coordsFromObs(o: MoObservation): Coordinates | undefined {
  const lat = num(o.latitude);
  const lng = num(o.longitude);
  if (lat === undefined || lng === undefined) return undefined;
  return { lat, lng };
}

function coordsFromLocation(
  loc: MoLocationEmbedded | MoLocation | null | undefined,
): Coordinates | undefined {
  if (!loc) return undefined;
  const n = num(loc.latitude_north);
  const s = num(loc.latitude_south);
  const e = num(loc.longitude_east);
  const w = num(loc.longitude_west);
  if (n === undefined || s === undefined || e === undefined || w === undefined) {
    return undefined;
  }
  return { lat: (n + s) / 2, lng: (e + w) / 2 };
}

export interface NormalizedMoObservation {
  id: number;
  date: string | undefined;
  /** Reported coordinates if exact (gps_hidden=false), otherwise the
   *  centroid of the obscured location (`location.lat/lng` averages). */
  coordinates: Coordinates | undefined;
  /** True if the observation's exact coords are obscured. */
  gpsHidden: boolean;
  locationName: string | undefined;
  locationId: number | undefined;
  consensusName: string | undefined;
  consensusId: number | undefined;
  /** Vote-weighted ID confidence in [-3..3]. */
  confidence: number | undefined;
  hasImages: boolean;
  primaryImageUrl: string | undefined;
  observerLogin: string | undefined;
  notes: string;
  url: string;
  createdAt: string | undefined;
  updatedAt: string | undefined;
}

const OBS_URL = (id: number): string => `https://mushroomobserver.org/${id}`;

export function normalizeObservation(o: MoObservation): NormalizedMoObservation {
  const gpsHidden = o.gps_hidden === true;
  const coords = coordsFromObs(o) ?? coordsFromLocation(o.location ?? null);

  const consensusName =
    o.consensus_name ?? o.consensus?.name ?? undefined;
  const consensusId =
    o.consensus_id ?? o.consensus?.id ?? undefined;

  const locationName = o.location_name ?? o.location?.name ?? undefined;
  const locationId = o.location_id ?? o.location?.id ?? undefined;

  const observerLogin =
    o.owner?.login_name ?? undefined;

  const primaryImageUrl =
    o.primary_image?.original_url ??
    (o.primary_image_id !== null && o.primary_image_id !== undefined
      ? `https://mushroomobserver.org/images/orig/${o.primary_image_id}.jpg`
      : undefined);

  const hasImages =
    primaryImageUrl !== undefined ||
    (Array.isArray(o.images) && o.images.length > 0);

  const result: NormalizedMoObservation = {
    id: o.id,
    date: o.date ?? undefined,
    coordinates: coords,
    gpsHidden,
    locationName,
    locationId,
    consensusName,
    consensusId,
    confidence: o.confidence ?? undefined,
    hasImages,
    primaryImageUrl,
    observerLogin,
    notes: stripHtml(o.notes ?? ""),
    url: OBS_URL(o.id),
    createdAt: o.created_at ?? undefined,
    updatedAt: o.updated_at ?? undefined,
  };
  return result;
}

export interface NormalizedMoName {
  id: number;
  scientificName: string;
  author: string | undefined;
  rank: string | undefined;
  deprecated: boolean;
  citation: string | undefined;
  classification: string[];
  numberOfViews: number | undefined;
  url: string;
}

const NAME_URL = (id: number): string =>
  `https://mushroomobserver.org/name/show_name/${id}`;

export function normalizeName(n: MoName): NormalizedMoName {
  const parents = (n.parents ?? [])
    .map((p) => p.name)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  const result: NormalizedMoName = {
    id: n.id,
    scientificName: n.name,
    author: n.author ?? undefined,
    rank: n.rank ?? undefined,
    deprecated: n.deprecated === true,
    citation: stripHtml(n.citation ?? "") || undefined,
    classification: parents,
    numberOfViews: n.number_of_views ?? undefined,
    url: NAME_URL(n.id),
  };
  return result;
}

export interface NormalizedMoLocation {
  id: number;
  name: string;
  /** Centroid (mean of corner coords). */
  coordinates: Coordinates | undefined;
  bbox:
    | {
        north: number;
        south: number;
        east: number;
        west: number;
      }
    | undefined;
}

export function normalizeLocation(loc: MoLocation): NormalizedMoLocation {
  const n = num(loc.latitude_north);
  const s = num(loc.latitude_south);
  const e = num(loc.longitude_east);
  const w = num(loc.longitude_west);
  const bbox =
    n !== undefined && s !== undefined && e !== undefined && w !== undefined
      ? { north: n, south: s, east: e, west: w }
      : undefined;
  const result: NormalizedMoLocation = {
    id: loc.id,
    name: loc.name,
    coordinates: bbox
      ? { lat: (bbox.north + bbox.south) / 2, lng: (bbox.east + bbox.west) / 2 }
      : undefined,
    bbox,
  };
  return result;
}
