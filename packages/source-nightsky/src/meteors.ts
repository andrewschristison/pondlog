import { ok, type Result } from "@pondlog/core";
import showersData from "./data/meteor-showers.json" with { type: "json" };
import { getMoonPhase } from "./moon.js";
import { resolveDate } from "./sun.js";
import type { MeteorShower, MeteorShowerListing } from "./types.js";

interface RawShower {
  id: string;
  name: string;
  activeStart: string;
  activeEnd: string;
  peakMonth: number;
  peakDay: number;
  zhr: number;
  radiantRaHours: number;
  radiantDecDeg: number;
  parentObject: string;
  hemisphere: "northern" | "southern" | "both" | "equatorial";
  notes: string;
}

const SHOWERS = showersData as RawShower[];

export interface GetActiveMeteorShowersParams {
  date?: Date | string;
  /** How many days ahead to scan for "upcoming peaks". Default 14. */
  upcomingDays?: number;
}

export function getActiveMeteorShowers(
  params: GetActiveMeteorShowersParams = {},
): Result<MeteorShowerListing> {
  const date = resolveDate(params.date);
  if (!date.ok) return date;
  const upcomingDays = params.upcomingDays ?? 14;

  const moon = getMoonPhase({ date: date.data });
  // moon should always succeed (no coords required), but if it ever errors,
  // surface that, meteor predictions without moon context are misleading.
  if (!moon.ok) return moon;

  const moonInterference = moonInterferenceLevel(moon.data.illuminationFraction);

  const enriched = SHOWERS.map((s) => enrichShower(s, date.data, moonInterference));

  const active = enriched
    .filter((s) => isActiveOn(s, date.data))
    .sort((a, b) => {
      const aDist = Math.abs(a.daysToPeak);
      const bDist = Math.abs(b.daysToPeak);
      if (aDist !== bDist) return aDist - bDist;
      return b.zhr - a.zhr;
    });

  const upcoming = enriched
    .filter((s) => s.daysToPeak >= 0 && s.daysToPeak <= upcomingDays)
    .sort((a, b) => a.daysToPeak - b.daysToPeak);

  return ok({
    date: date.data.toISOString(),
    active,
    upcoming,
  });
}

function enrichShower(
  raw: RawShower,
  refDate: Date,
  moonInterference: MeteorShower["moonInterference"],
): MeteorShower {
  const peakDate = peakDateFor(raw, refDate);
  const daysToPeak =
    Math.round((peakDate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000)) ||
    0;
  return {
    id: raw.id,
    name: raw.name,
    activeStart: raw.activeStart,
    activeEnd: raw.activeEnd,
    peakDate: peakDate.toISOString(),
    daysToPeak,
    zhr: raw.zhr,
    radiantRaHours: raw.radiantRaHours,
    radiantDecDeg: raw.radiantDecDeg,
    parentObject: raw.parentObject,
    hemisphere: raw.hemisphere,
    notes: raw.notes,
    moonInterference,
  };
}

/** Resolve a shower's `peakMonth/peakDay` to a Date in the same year as `refDate`,
 *  rolling forward if the peak has already passed by more than 14 days (so
 *  Dec→Jan transitions show next year's Quadrantids as "upcoming"). */
function peakDateFor(raw: RawShower, refDate: Date): Date {
  const year = refDate.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, raw.peakMonth - 1, raw.peakDay, 6, 0, 0));
  const daysDiff =
    (candidate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000);
  if (daysDiff < -14) {
    candidate = new Date(Date.UTC(year + 1, raw.peakMonth - 1, raw.peakDay, 6, 0, 0));
  }
  return candidate;
}

/** Active windows are encoded as "MM-DD" strings. Some windows wrap the new
 *  year (e.g. Quadrantids 12-28 → 01-12). Compare numeric MMDD values, with
 *  a wrap-aware OR for the cross-year case. */
function isActiveOn(shower: MeteorShower, refDate: Date): boolean {
  const refMmdd = mmdd(refDate);
  const start = parseMmdd(shower.activeStart);
  const end = parseMmdd(shower.activeEnd);
  if (start === null || end === null) return false;
  if (start <= end) {
    return refMmdd >= start && refMmdd <= end;
  }
  // Wraps the year boundary.
  return refMmdd >= start || refMmdd <= end;
}

function mmdd(d: Date): number {
  return (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function parseMmdd(s: string): number | null {
  const parts = s.split("-");
  if (parts.length !== 2) return null;
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return month * 100 + day;
}

export function moonInterferenceLevel(
  illuminationFraction: number,
): MeteorShower["moonInterference"] {
  // Faint meteors disappear under any significant moonlight. The ZHR ratings
  // assume a moonless sky, so even a half moon is "moderate" interference.
  if (illuminationFraction < 0.1) return "none";
  if (illuminationFraction < 0.4) return "low";
  if (illuminationFraction < 0.75) return "moderate";
  return "high";
}
