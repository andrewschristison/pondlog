import { ok, type Coordinates, type Result } from "@pondlog/core";
import {
  Body,
  Illumination,
  MakeTime,
  MoonPhase as MoonPhaseAngle,
  Observer,
  SearchRiseSet,
} from "astronomy-engine";
import { resolveDate } from "./sun.js";
import type { MoonPhase, MoonPhaseName } from "./types.js";

const SYNODIC_MONTH_DAYS = 29.530588853;

export interface GetMoonPhaseParams {
  /** Optional — without coordinates, rise/set are omitted. */
  coords?: Coordinates;
  date?: Date | string;
}

export function getMoonPhase(params: GetMoonPhaseParams = {}): Result<MoonPhase> {
  const date = resolveDate(params.date);
  if (!date.ok) return date;

  const phaseAngleDeg = MoonPhaseAngle(date.data);
  const illum = Illumination(Body.Moon, date.data);
  const phase = phaseNameFromAngle(phaseAngleDeg);
  const ageDays = (phaseAngleDeg / 360) * SYNODIC_MONTH_DAYS;

  let rise: string | null = null;
  let set: string | null = null;
  if (params.coords) {
    const observer = new Observer(params.coords.lat, params.coords.lng, 0);
    const start = MakeTime(date.data);
    const r = SearchRiseSet(Body.Moon, observer, +1, start, 1);
    const s = SearchRiseSet(Body.Moon, observer, -1, start, 1);
    rise = r ? r.date.toISOString() : null;
    set = s ? s.date.toISOString() : null;
  }

  return ok({
    date: date.data.toISOString(),
    phase,
    emoji: emojiFromPhase(phase),
    phaseAngleDeg,
    illuminationFraction: illum.phase_fraction,
    ageDays,
    rise,
    set,
  });
}

export function phaseNameFromAngle(angleDeg: number): MoonPhaseName {
  // Astronomy-engine's MoonPhase returns the moon's ecliptic longitude minus
  // the sun's (0..360). Convention: 0=new, 90=first qtr, 180=full, 270=last qtr.
  // Quarters get a ±~6° band so the named milestones are usable on the night
  // they occur; the rest is split into the four crescent/gibbous arcs.
  const a = ((angleDeg % 360) + 360) % 360;
  if (a < 6 || a >= 354) return "New Moon";
  if (a < 84) return "Waxing Crescent";
  if (a < 96) return "First Quarter";
  if (a < 174) return "Waxing Gibbous";
  if (a < 186) return "Full Moon";
  if (a < 264) return "Waning Gibbous";
  if (a < 276) return "Last Quarter";
  return "Waning Crescent";
}

export function emojiFromPhase(phase: MoonPhaseName): string {
  switch (phase) {
    case "New Moon":
      return "🌑";
    case "Waxing Crescent":
      return "🌒";
    case "First Quarter":
      return "🌓";
    case "Waxing Gibbous":
      return "🌔";
    case "Full Moon":
      return "🌕";
    case "Waning Gibbous":
      return "🌖";
    case "Last Quarter":
      return "🌗";
    case "Waning Crescent":
      return "🌘";
  }
}
