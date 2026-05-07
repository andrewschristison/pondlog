import { ok, type Coordinates, type Result } from "@pondlog/core";
import { Horizon, MakeTime, Observer } from "astronomy-engine";
import { azimuthToCompass } from "./compass.js";
import constellationsData from "./data/constellations.json" with { type: "json" };
import { guardCoords, resolveDate } from "./sun.js";
import type { ConstellationListing, ConstellationVisibility } from "./types.js";

interface RawConstellation {
  iauCode: string;
  name: string;
  raHours: number;
  decDeg: number;
  hemisphere: "northern" | "southern" | "equatorial";
  bestMonths: number[];
  notableStars: string[];
  description: string;
}

const CONSTELLATIONS = constellationsData as RawConstellation[];

const MIN_VISIBLE_ALT_DEG = 15;

export interface GetVisibleConstellationsParams {
  coords: Coordinates;
  date?: Date | string;
}

export function getVisibleConstellations(
  params: GetVisibleConstellationsParams,
): Result<ConstellationListing> {
  const guard = guardCoords(params.coords);
  if (!guard.ok) return guard;
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const observer = new Observer(params.coords.lat, params.coords.lng, 0);
  const time = MakeTime(date.data);
  const month = date.data.getUTCMonth() + 1;

  const visible: ConstellationVisibility[] = [];
  for (const c of CONSTELLATIONS) {
    const horiz = Horizon(time, observer, c.raHours, c.decDeg, "normal");
    if (horiz.altitude < MIN_VISIBLE_ALT_DEG) continue;
    const culminationAlt = 90 - Math.abs(params.coords.lat - c.decDeg);
    visible.push({
      iauCode: c.iauCode,
      name: c.name,
      altitudeDeg: horiz.altitude,
      azimuthDeg: horiz.azimuth,
      direction: azimuthToCompass(horiz.azimuth),
      culminationAltDeg: culminationAlt,
      hemisphere: c.hemisphere,
      bestMonths: c.bestMonths,
      notableStars: c.notableStars,
      description: c.description,
      isInSeason: c.bestMonths.includes(month),
    });
  }

  // Sort: in-season first, then by altitude (highest first).
  visible.sort((a, b) => {
    if (a.isInSeason !== b.isInSeason) return a.isInSeason ? -1 : 1;
    return b.altitudeDeg - a.altitudeDeg;
  });

  return ok({
    referenceTime: date.data.toISOString(),
    coordinates: params.coords,
    visible,
  });
}
