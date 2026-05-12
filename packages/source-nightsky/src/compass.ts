import type { CompassDirection } from "./types.js";

const POINTS: CompassDirection[] = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** Convert an azimuth in degrees (0 = north, increasing clockwise) to a 16-point compass label. */
export function azimuthToCompass(azimuthDeg: number): CompassDirection {
  // Normalize to [0, 360).
  const a = ((azimuthDeg % 360) + 360) % 360;
  // 16 points → 22.5° per point. Offset by 11.25° so each label centers on its azimuth.
  const idx = Math.floor((a + 11.25) / 22.5) % 16;
  // We just modulo'd into [0,15] so the lookup is in-bounds, assert as defined to satisfy noUncheckedIndexedAccess.
  return POINTS[idx] as CompassDirection;
}
