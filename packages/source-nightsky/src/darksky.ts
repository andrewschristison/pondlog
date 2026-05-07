import { ok, type Coordinates, type Result } from "@pondlog/core";
import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MakeTime,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from "astronomy-engine";
import { resolveDate, guardCoords } from "./sun.js";
import type { DarkSkyWindow } from "./types.js";

export interface GetDarkSkyWindowParams {
  coords: Coordinates;
  date?: Date | string;
}

export function getDarkSkyWindow(
  params: GetDarkSkyWindowParams,
): Result<DarkSkyWindow> {
  const guard = guardCoords(params.coords);
  if (!guard.ok) return guard;
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const observer = new Observer(params.coords.lat, params.coords.lng, 0);
  const start = MakeTime(date.data);

  // Astronomical dark window: sun ≤ -18°. Setting (-1) gives the start, rising
  // (+1) the end. At high latitudes / midsummer, either or both can be null,
  // meaning astronomical dark never happens that night.
  const startTwilight = SearchAltitude(Body.Sun, observer, -1, start, 1, -18);
  const endTwilight = startTwilight
    ? SearchAltitude(Body.Sun, observer, +1, MakeTime(startTwilight.date), 1, -18)
    : null;

  const startIso = startTwilight ? startTwilight.date.toISOString() : null;
  const endIso = endTwilight ? endTwilight.date.toISOString() : null;

  const hours =
    startTwilight && endTwilight
      ? Math.max(
          0,
          (endTwilight.date.getTime() - startTwilight.date.getTime()) / 3_600_000,
        )
      : 0;

  // Pick a reference time for the moon snapshot. If we have a dark window,
  // sample at its midpoint — that's when stargazers are actually out. If we
  // don't, fall back to the nearest sunset (the time someone would *try* to
  // observe), or finally to the input date.
  let midTime: Date;
  if (startTwilight && endTwilight) {
    midTime = new Date(
      (startTwilight.date.getTime() + endTwilight.date.getTime()) / 2,
    );
  } else {
    const sunset = SearchRiseSet(Body.Sun, observer, -1, start, 1);
    midTime = sunset ? sunset.date : date.data;
  }

  const midAstroTime = MakeTime(midTime);
  const moonIllum = Illumination(Body.Moon, midAstroTime);
  const moonEq = Equator(Body.Moon, midAstroTime, observer, true, true);
  const moonHoriz = Horizon(midAstroTime, observer, moonEq.ra, moonEq.dec, "normal");

  const quality = scoreDarkSky({
    hasAstronomicalDark: !!(startTwilight && endTwilight),
    moonIlluminationFraction: moonIllum.phase_fraction,
    moonAltitudeDeg: moonHoriz.altitude,
  });

  return ok({
    date: date.data.toISOString(),
    coordinates: params.coords,
    start: startIso,
    end: endIso,
    hours,
    quality,
    qualityLabel: qualityLabel(quality),
    moonIlluminationAtMid: moonIllum.phase_fraction,
    moonAltAtMid: moonHoriz.altitude,
  });
}

interface ScoreInputs {
  hasAstronomicalDark: boolean;
  moonIlluminationFraction: number;
  moonAltitudeDeg: number;
}

/** Produce a 1..5 darkness rating.
 *
 *  Rule of thumb the formula encodes:
 *  - 5 ★: true astronomical dark, moon below horizon OR illumination < 10%.
 *  - 4 ★: astronomical dark, moon up but quarter-or-less.
 *  - 3 ★: nautical-only twilight (no astronomical dark) OR gibbous moon.
 *  - 2 ★: bright moon high overhead during dark window.
 *  - 1 ★: full moon overhead, or no dark of any kind. */
export function scoreDarkSky(inputs: ScoreInputs): 1 | 2 | 3 | 4 | 5 {
  const { hasAstronomicalDark, moonIlluminationFraction, moonAltitudeDeg } = inputs;

  // Moon below horizon contributes nothing — only its visible light matters.
  const effectiveBrightness =
    moonAltitudeDeg <= 0
      ? 0
      : moonIlluminationFraction *
        // Light contribution scales with altitude up to ~30°; flat above.
        Math.min(1, moonAltitudeDeg / 30);

  if (!hasAstronomicalDark) {
    if (effectiveBrightness >= 0.7) return 1;
    if (effectiveBrightness >= 0.4) return 2;
    return 3;
  }

  if (effectiveBrightness >= 0.85) return 1;
  if (effectiveBrightness >= 0.6) return 2;
  if (effectiveBrightness >= 0.3) return 3;
  if (effectiveBrightness >= 0.05) return 4;
  return 5;
}

export function qualityLabel(quality: 1 | 2 | 3 | 4 | 5): string {
  switch (quality) {
    case 5:
      return "Excellent";
    case 4:
      return "Good";
    case 3:
      return "Fair";
    case 2:
      return "Poor";
    case 1:
      return "Bright";
  }
}
