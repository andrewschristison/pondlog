import { err, ok, type Coordinates, type Result } from "@pondlog/core";
import {
  Body,
  MakeTime,
  Observer,
  SearchAltitude,
  SearchHourAngle,
  SearchRiseSet,
} from "astronomy-engine";
import type { SunTimes } from "./types.js";

const SEARCH_LIMIT_DAYS = 1;

export interface GetSunTimesParams {
  coords: Coordinates;
  /** Reference date — defaults to "now". JS Date or ISO string. */
  date?: Date | string;
}

export function getSunTimes(params: GetSunTimesParams): Result<SunTimes> {
  const guard = guardCoords(params.coords);
  if (!guard.ok) return guard;
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const observer = new Observer(params.coords.lat, params.coords.lng, 0);
  const start = MakeTime(date.data);

  // Sunrise / sunset — sun upper limb at sea-level horizon, normal refraction.
  const sunrise = SearchRiseSet(Body.Sun, observer, +1, start, SEARCH_LIMIT_DAYS);
  const sunset = SearchRiseSet(Body.Sun, observer, -1, start, SEARCH_LIMIT_DAYS);

  // Solar noon — hour angle 0 (sun crosses local meridian).
  let solarNoon: string | null = null;
  try {
    const transit = SearchHourAngle(Body.Sun, observer, 0, start, +1);
    solarNoon = transit.time.date.toISOString();
  } catch {
    solarNoon = null;
  }

  // Twilight altitudes for the sun. Direction +1 finds the next time the sun
  // rises through that altitude (morning), -1 the next time it sinks past it
  // (evening). At high latitudes one or both can be null.
  const civilDawn = altitudeIso(Body.Sun, observer, +1, start, -6);
  const civilDusk = altitudeIso(Body.Sun, observer, -1, start, -6);
  const nauticalDawn = altitudeIso(Body.Sun, observer, +1, start, -12);
  const nauticalDusk = altitudeIso(Body.Sun, observer, -1, start, -12);
  const astronomicalDawn = altitudeIso(Body.Sun, observer, +1, start, -18);
  const astronomicalDusk = altitudeIso(Body.Sun, observer, -1, start, -18);

  // Golden hour: ~6° solar altitude. Morning end / evening start.
  const goldenHourMorningEnd = altitudeIso(Body.Sun, observer, +1, start, 6);
  const goldenHourEveningStart = altitudeIso(Body.Sun, observer, -1, start, 6);

  return ok({
    date: date.data.toISOString(),
    coordinates: params.coords,
    sunrise: sunrise ? sunrise.date.toISOString() : null,
    sunset: sunset ? sunset.date.toISOString() : null,
    solarNoon,
    civilDawn,
    civilDusk,
    nauticalDawn,
    nauticalDusk,
    astronomicalDawn,
    astronomicalDusk,
    goldenHourMorningEnd,
    goldenHourEveningStart,
  });
}

function altitudeIso(
  body: Body,
  observer: Observer,
  direction: number,
  start: ReturnType<typeof MakeTime>,
  altitudeDeg: number,
): string | null {
  const t = SearchAltitude(body, observer, direction, start, SEARCH_LIMIT_DAYS, altitudeDeg);
  return t ? t.date.toISOString() : null;
}

export function guardCoords(coords: Coordinates): Result<true> {
  if (
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng) ||
    coords.lat < -90 ||
    coords.lat > 90 ||
    coords.lng < -180 ||
    coords.lng > 180
  ) {
    return err({
      source: "nightsky",
      message: `Invalid coordinates: ${coords.lat}, ${coords.lng} (lat must be -90..90, lng -180..180)`,
    });
  }
  return ok(true);
}

export function resolveDate(input: Date | string | undefined): Result<Date> {
  if (input === undefined) return ok(new Date());
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return err({ source: "nightsky", message: "Invalid Date object" });
    }
    return ok(input);
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return err({ source: "nightsky", message: `Could not parse date: ${input}` });
  }
  return ok(parsed);
}
