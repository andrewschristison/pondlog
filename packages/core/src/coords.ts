import type { Coordinates } from "./types.js";

export function validateCoordinates(coords: unknown): coords is Coordinates {
  if (typeof coords !== "object" || coords === null) return false;
  const c = coords as Record<string, unknown>;
  return (
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lng >= -180 &&
    c.lng <= 180
  );
}

export function parseLatLngString(value: string | null | undefined): Coordinates | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const [latStr, lngStr] = parts;
  if (latStr === undefined || lngStr === undefined) return null;
  const lat = Number.parseFloat(latStr.trim());
  const lng = Number.parseFloat(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const candidate = { lat, lng };
  return validateCoordinates(candidate) ? candidate : null;
}
