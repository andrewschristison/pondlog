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
