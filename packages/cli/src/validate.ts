import { err, ok, type Result } from "@pondlog/core";

const MAX_RADIUS_KM = 500;
const MAX_DAYS = 365;

function parseFiniteNumber(raw: string): Result<number> {
  if (raw.trim() === "") {
    return err({ source: "cli", message: "expected a number, got empty string" });
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return err({ source: "cli", message: `not a finite number: ${raw}` });
  }
  return ok(n);
}

export function parseLat(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --lat: ${r.error.message}` });
  if (r.data < -90 || r.data > 90) {
    return err({ source: "cli", message: `--lat out of range (-90..90): ${r.data}` });
  }
  return ok(r.data);
}

export function parseLng(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --lng: ${r.error.message}` });
  if (r.data < -180 || r.data > 180) {
    return err({ source: "cli", message: `--lng out of range (-180..180): ${r.data}` });
  }
  return ok(r.data);
}

export function parseRadiusKm(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --radius: ${r.error.message}` });
  if (r.data <= 0 || r.data > MAX_RADIUS_KM) {
    return err({
      source: "cli",
      message: `--radius out of range (0 < r <= ${MAX_RADIUS_KM} km): ${r.data}`,
    });
  }
  return ok(r.data);
}

export function parseDays(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --days: ${r.error.message}` });
  const days = Math.trunc(r.data);
  if (days < 1 || days > MAX_DAYS) {
    return err({
      source: "cli",
      message: `--days out of range (1..${MAX_DAYS}): ${r.data}`,
    });
  }
  return ok(days);
}

export function parseHistoricDate(raw: string): Result<{ year: number; month: number; day: number }> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) {
    return err({
      source: "cli",
      message: `invalid date "${raw}": expected YYYY-MM-DD`,
    });
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1800 || year > 9999) {
    return err({ source: "cli", message: `year out of range (1800..9999): ${year}` });
  }
  if (month < 1 || month > 12) {
    return err({ source: "cli", message: `month out of range (1..12): ${month}` });
  }
  if (day < 1 || day > 31) {
    return err({ source: "cli", message: `day out of range (1..31): ${day}` });
  }
  return ok({ year, month, day });
}

export function parseSpeciesCode(raw: string): Result<string> {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[a-z0-9]{4,10}$/.test(trimmed)) {
    return err({
      source: "cli",
      message: `invalid species code "${raw}": expected 4–10 lowercase letters/digits (e.g. "amecro", "barowl")`,
    });
  }
  return ok(trimmed);
}

export function parseRegionCode(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9-]{2,12}$/.test(trimmed)) {
    return err({
      source: "cli",
      message: `invalid region code "${raw}": expected eBird region code (e.g. "US", "US-WA", "US-WA-009")`,
    });
  }
  return ok(trimmed);
}
