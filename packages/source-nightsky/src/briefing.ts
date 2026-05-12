import { ok, type Coordinates, type Result } from "@pondlog/core";
import {
  Body,
  MakeTime,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from "astronomy-engine";
import { getVisibleConstellations } from "./constellations.js";
import { getDarkSkyWindow } from "./darksky.js";
import { getActiveMeteorShowers } from "./meteors.js";
import { getMoonPhase } from "./moon.js";
import { getPlanetPositions } from "./planets.js";
import { getSunTimes, guardCoords, resolveDate } from "./sun.js";
import type {
  MeteorShower,
  NightSkyBriefing,
  PlanetPosition,
} from "./types.js";

export interface GetTonightsBriefingParams {
  coords: Coordinates;
  date?: Date | string;
}

export function getTonightsBriefing(
  params: GetTonightsBriefingParams,
): Result<NightSkyBriefing> {
  const guard = guardCoords(params.coords);
  if (!guard.ok) return guard;
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const observer = new Observer(params.coords.lat, params.coords.lng, 0);
  const referenceTime = pickNightReferenceTime(observer, date.data);

  const sun = getSunTimes({ coords: params.coords, date: date.data });
  if (!sun.ok) return sun;

  const moon = getMoonPhase({ coords: params.coords, date: referenceTime });
  if (!moon.ok) return moon;

  const darkSky = getDarkSkyWindow({ coords: params.coords, date: date.data });
  if (!darkSky.ok) return darkSky;

  const planets = getPlanetPositions({ coords: params.coords, date: referenceTime });
  if (!planets.ok) return planets;

  const meteors = getActiveMeteorShowers({ date: date.data });
  if (!meteors.ok) return meteors;

  const constellations = getVisibleConstellations({
    coords: params.coords,
    date: referenceTime,
  });
  if (!constellations.ok) return constellations;

  const visiblePlanets = planets.data.planets.filter((p) => p.isVisible);
  const visibleConstellations = constellations.data.visible.slice(0, 8);

  return ok({
    date: date.data.toISOString(),
    referenceTime: referenceTime.toISOString(),
    coordinates: params.coords,
    sun: sun.data,
    moon: moon.data,
    darkSky: darkSky.data,
    visiblePlanets,
    activeMeteorShowers: meteors.data.active,
    upcomingMeteorShowers: meteors.data.upcoming,
    visibleConstellations,
    highlight: composeHighlight({
      moonPhase: moon.data.phase,
      moonEmoji: moon.data.emoji,
      darkQualityLabel: darkSky.data.qualityLabel,
      darkQuality: darkSky.data.quality,
      visiblePlanets,
      activeShowers: meteors.data.active,
      upcomingShowers: meteors.data.upcoming,
      topConstellation: visibleConstellations[0]?.name,
    }),
  });
}

/** Pick a wall-clock reference time for "tonight's" planet/constellation snapshot.
 *
 *  Preference order:
 *    1. Midpoint of astronomical dark (sun ≤ -18°), if it occurs in the next 24h.
 *    2. Midpoint between sunset and the following sunrise.
 *    3. The input date itself (last resort, e.g. polar day where neither rise nor
 *       astronomical dark occurs). */
function pickNightReferenceTime(observer: Observer, date: Date): Date {
  const start = MakeTime(date);

  const dusk = SearchAltitude(Body.Sun, observer, -1, start, 1, -18);
  if (dusk) {
    const dawn = SearchAltitude(Body.Sun, observer, +1, MakeTime(dusk.date), 1, -18);
    if (dawn) {
      return new Date((dusk.date.getTime() + dawn.date.getTime()) / 2);
    }
  }

  const sunset = SearchRiseSet(Body.Sun, observer, -1, start, 1);
  if (sunset) {
    const sunrise = SearchRiseSet(Body.Sun, observer, +1, MakeTime(sunset.date), 1);
    if (sunrise) {
      return new Date((sunset.date.getTime() + sunrise.date.getTime()) / 2);
    }
    // Sunset but no following sunrise (high latitude polar twilight), pick
    // an hour past sunset as a usable observation moment.
    return new Date(sunset.date.getTime() + 60 * 60_000);
  }

  return date;
}

interface HighlightInputs {
  moonPhase: string;
  moonEmoji: string;
  darkQualityLabel: string;
  darkQuality: number;
  visiblePlanets: PlanetPosition[];
  activeShowers: MeteorShower[];
  upcomingShowers: MeteorShower[];
  topConstellation: string | undefined;
}

function composeHighlight(input: HighlightInputs): string {
  const parts: string[] = [];
  parts.push(`${input.moonEmoji} ${input.moonPhase}, sky ${input.darkQualityLabel.toLowerCase()}`);

  const brightest = [...input.visiblePlanets]
    .sort((a, b) => a.magnitude - b.magnitude)
    .slice(0, 2);
  if (brightest.length > 0) {
    parts.push(
      `planets: ${brightest.map((p) => `${p.name} ${p.direction}`).join(", ")}`,
    );
  }

  const peakingNow = input.activeShowers.find(
    (s) => Math.abs(s.daysToPeak) <= 2,
  );
  if (peakingNow) {
    parts.push(
      `${peakingNow.name} peaking ${peakingNow.daysToPeak === 0 ? "tonight" : `${Math.abs(peakingNow.daysToPeak)}d ${peakingNow.daysToPeak < 0 ? "ago" : "out"}`}`,
    );
  } else if (input.activeShowers[0]) {
    const s = input.activeShowers[0];
    parts.push(
      `${s.name} active (peak ${s.daysToPeak < 0 ? `${-s.daysToPeak}d ago` : `${s.daysToPeak}d out`})`,
    );
  } else if (input.upcomingShowers[0]) {
    const s = input.upcomingShowers[0];
    parts.push(`${s.name} peaks in ${s.daysToPeak}d`);
  }

  if (input.topConstellation) {
    parts.push(`${input.topConstellation} overhead`);
  }

  return parts.join(" · ");
}
