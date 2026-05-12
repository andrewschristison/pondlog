import { ok, type Coordinates, type Result } from "@pondlog/core";
import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MakeTime,
  Observer,
  SearchRiseSet,
} from "astronomy-engine";
import { azimuthToCompass } from "./compass.js";
import { guardCoords, resolveDate } from "./sun.js";
import type { PlanetPosition, PlanetPositions } from "./types.js";

const VISIBLE_PLANETS: ReadonlyArray<{ body: Body; name: string }> = [
  { body: Body.Mercury, name: "Mercury" },
  { body: Body.Venus, name: "Venus" },
  { body: Body.Mars, name: "Mars" },
  { body: Body.Jupiter, name: "Jupiter" },
  { body: Body.Saturn, name: "Saturn" },
  { body: Body.Uranus, name: "Uranus" },
  { body: Body.Neptune, name: "Neptune" },
];

const NAKED_EYE_MAG_LIMIT = 6.0;
const HORIZON_HAZE_DEG = 5.0;
const CIVIL_TWILIGHT_DEG = -6.0;

export interface GetPlanetPositionsParams {
  coords: Coordinates;
  date?: Date | string;
}

export function getPlanetPositions(
  params: GetPlanetPositionsParams,
): Result<PlanetPositions> {
  const guard = guardCoords(params.coords);
  if (!guard.ok) return guard;
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const time = MakeTime(date.data);
  const observer = new Observer(params.coords.lat, params.coords.lng, 0);

  // Sun altitude at the reference time controls "is it dark enough to see planets".
  const sunEq = Equator(Body.Sun, time, observer, true, true);
  const sunHoriz = Horizon(time, observer, sunEq.ra, sunEq.dec, "normal");
  const isDark = sunHoriz.altitude <= CIVIL_TWILIGHT_DEG;

  const planets: PlanetPosition[] = VISIBLE_PLANETS.map(({ body, name }) =>
    snapshotPlanet(body, name, time, observer, isDark),
  );

  return ok({
    referenceTime: date.data.toISOString(),
    coordinates: params.coords,
    isDark,
    planets,
  });
}

function snapshotPlanet(
  body: Body,
  name: string,
  time: ReturnType<typeof MakeTime>,
  observer: Observer,
  isDark: boolean,
): PlanetPosition {
  const eq = Equator(body, time, observer, true, true);
  const horiz = Horizon(time, observer, eq.ra, eq.dec, "normal");
  const illum = Illumination(body, time);

  const rise = SearchRiseSet(body, observer, +1, time, 1);
  const set = SearchRiseSet(body, observer, -1, time, 1);

  const azimuth = horiz.azimuth;
  const altitude = horiz.altitude;
  const isVisible =
    isDark && altitude > HORIZON_HAZE_DEG && illum.mag <= NAKED_EYE_MAG_LIMIT;

  return {
    name,
    magnitude: illum.mag,
    altitudeDeg: altitude,
    azimuthDeg: azimuth,
    direction: azimuthToCompass(azimuth),
    rise: rise ? rise.date.toISOString() : null,
    set: set ? set.date.toISOString() : null,
    isVisible,
    highlight: highlightFor(name, altitude, illum.mag, isVisible, isDark),
  };
}

function highlightFor(
  name: string,
  altitude: number,
  magnitude: number,
  isVisible: boolean,
  isDark: boolean,
): string | null {
  if (!isVisible) {
    if (!isDark) return null;
    if (altitude <= 0) {
      return `${name} is below the horizon (${altitude.toFixed(0)}°).`;
    }
    if (altitude < HORIZON_HAZE_DEG) {
      return `${name} is near the horizon (${altitude.toFixed(0)}°), likely hidden by atmospheric haze.`;
    }
    if (magnitude > NAKED_EYE_MAG_LIMIT) {
      return `${name} is up but at mag ${magnitude.toFixed(1)}, telescope or binoculars only.`;
    }
    return null;
  }
  if (magnitude < -3) {
    return `${name} is brilliant (mag ${magnitude.toFixed(1)}), the brightest object after the moon.`;
  }
  if (magnitude < -1) {
    return `${name} is bright (mag ${magnitude.toFixed(1)}), easy naked-eye target.`;
  }
  if (magnitude < 2) {
    return `${name} is naked-eye visible (mag ${magnitude.toFixed(1)}).`;
  }
  if (magnitude < 5) {
    return `${name} is faint (mag ${magnitude.toFixed(1)}) but visible from a dark site.`;
  }
  return `${name} is at the naked-eye limit (mag ${magnitude.toFixed(1)}), binoculars recommended.`;
}
