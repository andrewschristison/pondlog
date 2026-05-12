import type { Coordinates } from "@pondlog/core";
import type { UsgsTimeSeries, UsgsValue } from "./schemas.js";

/** USGS encodes "no value" as -999999.0 in numeric fields. Our Zod schema accepts
 *  any number; this helper translates the sentinel (or non-finite parses) to
 *  undefined so callers don't see magic numbers. */
const NO_DATA = -999999;

export function denull(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value === NO_DATA) return undefined;
  return value;
}

export interface NormalizedUsgsValue {
  /** ISO-8601 timestamp from the wire (with timezone offset on /iv/, naive on /dv/). */
  dateTime: string;
  /** Parsed numeric value. undefined if the wire value was the noDataValue sentinel
   *  or otherwise unparseable. */
  value: number | undefined;
  /** USGS quality codes, typically "P" (provisional) or "A" (approved). */
  qualifiers: string[];
}

export interface NormalizedUsgsSeries {
  /** USGS parameter code, e.g. "00060" (discharge) or "00065" (gage height). */
  parameterCode: string;
  /** Human-readable name e.g. "Streamflow, ft³/s". */
  variableName: string;
  /** Description e.g. "Discharge, cubic feet per second". */
  variableDescription?: string;
  /** Unit code e.g. "ft3/s", "ft". */
  unitCode: string;
  /** Optional statistic for daily values (Mean / Min / Max / etc.). */
  statistic?: string;
  values: NormalizedUsgsValue[];
}

export interface NormalizedUsgsSite {
  siteNumber: string;
  siteName: string;
  agencyCode: string;
  coordinates: Coordinates | null;
  timeZone?: string;
}

export interface NormalizedUsgsReading {
  site: NormalizedUsgsSite;
  series: NormalizedUsgsSeries[];
}

export function normalizeSite(ts: UsgsTimeSeries): NormalizedUsgsSite {
  const code = ts.sourceInfo.siteCode[0];
  const geog = ts.sourceInfo.geoLocation.geogLocation;
  const lat = denull(geog.latitude);
  const lng = denull(geog.longitude);
  const coords =
    typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
  const out: NormalizedUsgsSite = {
    siteNumber: code?.value ?? "",
    siteName: ts.sourceInfo.siteName,
    agencyCode: code?.agencyCode ?? "USGS",
    coordinates: coords,
  };
  const tz = ts.sourceInfo.timeZoneInfo?.defaultTimeZone?.zoneAbbreviation;
  if (typeof tz === "string" && tz.length > 0) out.timeZone = tz;
  return out;
}

function parseNumeric(raw: string): number | undefined {
  if (raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n === NO_DATA) return undefined;
  return n;
}

export function normalizeValue(
  v: UsgsValue,
  noDataValue: number | undefined,
): NormalizedUsgsValue {
  let parsed = parseNumeric(v.value);
  if (
    parsed !== undefined &&
    typeof noDataValue === "number" &&
    parsed === noDataValue
  ) {
    parsed = undefined;
  }
  return {
    dateTime: v.dateTime,
    value: parsed,
    qualifiers: v.qualifiers ?? [],
  };
}

function pickStatistic(ts: UsgsTimeSeries): string | undefined {
  const opts = ts.variable.options?.option;
  if (!opts) return undefined;
  const stat = opts.find((o) => o.name === "Statistic");
  // /iv/ ships optionCode "00000" with no `value`; only return a stat name when
  // the API actually labels it (e.g. /dv/ ships "Mean").
  if (stat && typeof stat.value === "string" && stat.value.length > 0) {
    return stat.value;
  }
  return undefined;
}

/** Group all timeSeries entries from a USGS response by site. The wire format
 *  emits one timeSeries per (site, variable, statistic), the same site shows
 *  up multiple times when both 00060 and 00065 are requested. */
export function groupBySite(
  timeSeries: UsgsTimeSeries[],
): NormalizedUsgsReading[] {
  const bySite = new Map<string, NormalizedUsgsReading>();
  for (const ts of timeSeries) {
    const site = normalizeSite(ts);
    const key = site.siteNumber || `${site.siteName}:${ts.name}`;
    let entry = bySite.get(key);
    if (!entry) {
      entry = { site, series: [] };
      bySite.set(key, entry);
    }
    const variableCode = ts.variable.variableCode[0]?.value ?? "";
    const noData = ts.variable.noDataValue;
    const series: NormalizedUsgsSeries = {
      parameterCode: variableCode,
      variableName: decodeEntities(ts.variable.variableName),
      unitCode: ts.variable.unit.unitCode,
      values: ts.values
        .flatMap((g) => g.value.map((v) => normalizeValue(v, noData))),
    };
    if (ts.variable.variableDescription) {
      series.variableDescription = ts.variable.variableDescription;
    }
    const stat = pickStatistic(ts);
    if (stat) series.statistic = stat;
    entry.series.push(series);
  }
  return [...bySite.values()];
}

/** USGS variable names ship with HTML entities for ³ and similar. Decode the
 *  handful that actually show up on the wire so terminal output is readable. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#179;/g, "³")
    .replace(/&#178;/g, "²")
    .replace(/&amp;/g, "&");
}

/** RDB parser for the /site/ endpoint, which does not support JSON.
 *  RDB is tab-delimited with `#` comment lines, a header row, a type/width row,
 *  then data rows. Returns one object per data row keyed by column name. */
export function parseRdb(body: string): Array<Record<string, string>> {
  const lines = body.split(/\r?\n/);
  let header: string[] | undefined;
  let skippedTypeRow = false;
  const rows: Array<Record<string, string>> = [];
  for (const line of lines) {
    if (line.startsWith("#") || line.length === 0) continue;
    if (!header) {
      header = line.split("\t");
      continue;
    }
    if (!skippedTypeRow) {
      // The row immediately after the header is the "type/width" row, e.g.
      // "5s\t15s\t50s\t...". Skip it.
      skippedTypeRow = true;
      continue;
    }
    const parts = line.split("\t");
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (typeof key !== "string") continue;
      row[key] = (parts[i] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

export interface NormalizedUsgsSiteRecord extends NormalizedUsgsSite {
  siteType?: string;
  hucCode?: string;
  stateCode?: string;
  countyCode?: string;
  altitudeFt?: number;
}

export function normalizeRdbSite(
  row: Record<string, string>,
): NormalizedUsgsSiteRecord {
  const lat = Number(row.dec_lat_va);
  const lng = Number(row.dec_long_va);
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const out: NormalizedUsgsSiteRecord = {
    siteNumber: row.site_no ?? "",
    siteName: row.station_nm ?? "",
    agencyCode: row.agency_cd ?? "USGS",
    coordinates: coords,
  };
  if (row.site_tp_cd) out.siteType = row.site_tp_cd;
  if (row.huc_cd) out.hucCode = row.huc_cd;
  if (row.state_cd) out.stateCode = row.state_cd;
  if (row.county_cd) out.countyCode = row.county_cd;
  const alt = Number(row.alt_va);
  if (Number.isFinite(alt)) out.altitudeFt = alt;
  return out;
}
