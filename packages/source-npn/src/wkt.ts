import type { Coordinates } from "@pondlog/core";

const KM_PER_DEG_LAT = 111.0;

/**
 * Build a Well-Known Text POLYGON for a square bounding box of `radiusKm`
 * around `center`. NPN's getStationsByLocation accepts WKT geometries; lat/lng
 * search is not natively supported.
 *
 * The polygon is approximated as a flat-earth square, accurate to a few
 * percent for radii under ~100km away from the poles, which is the regime
 * pondlog cares about (Port Angeles, ~48°N, 25–50km radii).
 *
 * Coordinate order in WKT is `lng lat` (X Y), and the polygon must close
 * (first point repeated as last).
 */
export function bboxWkt(center: Coordinates, radiusKm: number): string {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error(`bboxWkt: radiusKm must be positive, got ${radiusKm}`);
  }
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  // Guard against pathological cosLat near the poles so the box doesn't blow up.
  const safeCos = Math.max(0.001, Math.abs(cosLat));
  const dLng = radiusKm / (KM_PER_DEG_LAT * safeCos);

  const minLat = clampLat(center.lat - dLat);
  const maxLat = clampLat(center.lat + dLat);
  const minLng = wrapLng(center.lng - dLng);
  const maxLng = wrapLng(center.lng + dLng);

  // POLYGON((minLng minLat, maxLng minLat, maxLng maxLat, minLng maxLat, minLng minLat))
  const ring = [
    `${minLng} ${minLat}`,
    `${maxLng} ${minLat}`,
    `${maxLng} ${maxLat}`,
    `${minLng} ${maxLat}`,
    `${minLng} ${minLat}`,
  ].join(", ");
  return `POLYGON((${ring}))`;
}

function clampLat(lat: number): number {
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return Number.parseFloat(lat.toFixed(6));
}

function wrapLng(lng: number): number {
  // Antimeridian wrap is a real concern for callers near ±180; for the
  // contiguous-US use case we simply round to keep WKT compact.
  return Number.parseFloat(lng.toFixed(6));
}

/** Haversine distance in km between two coordinates. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat1 = Math.sin(dLat / 2);
  const sLng1 = Math.sin(dLng / 2);
  const h =
    sLat1 * sLat1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLng1 * sLng1;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
