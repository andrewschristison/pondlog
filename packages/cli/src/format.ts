import type {
  IconicTaxon,
  Observation,
  SpeciesCount,
  Taxon,
} from "@pondlog/core";
import pc from "picocolors";

const ICONIC_ORDER: IconicTaxon[] = [
  "Aves",
  "Mammalia",
  "Amphibia",
  "Reptilia",
  "Actinopterygii",
  "Insecta",
  "Arachnida",
  "Mollusca",
  "Plantae",
  "Fungi",
  "Animalia",
  "Protozoa",
  "Chromista",
  "Unknown",
];

export function formatRelativeDate(input: string, now: Date = new Date()): string {
  if (!input) return "unknown";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const diffMs = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / oneDay);
  if (days < 0) return iso(date);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return iso(date);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function header(line: string): string {
  return pc.bold(line);
}

export function dim(line: string): string {
  return pc.dim(line);
}

export function locationLine(opts: {
  name: string | undefined;
  lat: number;
  lng: number;
  radiusKm: number;
  days?: number;
}): string {
  const place = opts.name
    ? `${opts.name} (${opts.lat.toFixed(3)}, ${opts.lng.toFixed(3)})`
    : `${opts.lat.toFixed(3)}, ${opts.lng.toFixed(3)}`;
  const parts = [place, `${opts.radiusKm} km`];
  if (typeof opts.days === "number") parts.push(`last ${opts.days} days`);
  return pc.bold(parts.join("  ·  "));
}

export function groupByIconic(
  observations: Observation[],
): Map<IconicTaxon, Observation[]> {
  const map = new Map<IconicTaxon, Observation[]>();
  for (const obs of observations) {
    const list = map.get(obs.iconicTaxon) ?? [];
    list.push(obs);
    map.set(obs.iconicTaxon, list);
  }
  return new Map(
    [...map.entries()].sort(
      ([a], [b]) => ICONIC_ORDER.indexOf(a) - ICONIC_ORDER.indexOf(b),
    ),
  );
}

export function groupSpeciesByIconic(
  rows: SpeciesCount[],
): Map<IconicTaxon, SpeciesCount[]> {
  const map = new Map<IconicTaxon, SpeciesCount[]>();
  for (const row of rows) {
    const list = map.get(row.iconicTaxon) ?? [];
    list.push(row);
    map.set(row.iconicTaxon, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.count - a.count);
  }
  return new Map(
    [...map.entries()].sort(
      ([a], [b]) => ICONIC_ORDER.indexOf(a) - ICONIC_ORDER.indexOf(b),
    ),
  );
}

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function padStart(s: string, width: number): string {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}

function visualLength(s: string): number {
  // picocolors uses ANSI escapes; strip for width calc
  return s.replace(/\[[0-9;]*m/g, "").length;
}

function padEndVisual(s: string, width: number): string {
  const len = visualLength(s);
  return len >= width ? s : s + " ".repeat(width - len);
}

export function formatObservation(obs: Observation, widths: { common: number; sci: number; rel: number }): string {
  const common = pc.bold(obs.commonName);
  const sci = pc.dim(obs.taxonName);
  const rel = formatRelativeDate(obs.observedAt);
  return `  ${padEndVisual(common, widths.common)}  ${padEndVisual(sci, widths.sci)}  ${padEnd(rel, widths.rel)}  ${pc.dim("·")}  ${obs.observerName}`;
}

export function formatSpeciesRow(row: SpeciesCount, widths: { common: number; sci: number }): string {
  const common = pc.bold(row.commonName);
  const sci = pc.dim(row.taxonName);
  const count = padStart(String(row.count), 5);
  return `  ${count}  ${padEndVisual(common, widths.common)}  ${padEndVisual(sci, widths.sci)}`;
}

export function computeObservationWidths(observations: Observation[]): {
  common: number;
  sci: number;
  rel: number;
} {
  let common = 8;
  let sci = 8;
  let rel = 8;
  for (const o of observations) {
    common = Math.max(common, o.commonName.length);
    sci = Math.max(sci, o.taxonName.length);
    rel = Math.max(rel, formatRelativeDate(o.observedAt).length);
  }
  return {
    common: Math.min(common, 32),
    sci: Math.min(sci, 36),
    rel: Math.min(rel, 14),
  };
}

export function computeSpeciesWidths(rows: SpeciesCount[]): {
  common: number;
  sci: number;
} {
  let common = 8;
  let sci = 8;
  for (const r of rows) {
    common = Math.max(common, r.commonName.length);
    sci = Math.max(sci, r.taxonName.length);
  }
  return {
    common: Math.min(common, 32),
    sci: Math.min(sci, 36),
  };
}

export function formatTaxon(t: Taxon, observationsCount?: number): string {
  const lines: string[] = [];
  lines.push(`  ${pc.bold(t.commonName)}  ${pc.dim(t.name)}`);
  const meta: string[] = [];
  if (t.rank) meta.push(`rank: ${t.rank}`);
  if (t.iconicTaxon !== "Unknown") meta.push(`group: ${t.iconicTaxon}`);
  if (typeof observationsCount === "number") {
    meta.push(`observations: ${observationsCount.toLocaleString()}`);
  }
  if (meta.length > 0) lines.push(`  ${pc.dim(meta.join("  ·  "))}`);
  return lines.join("\n");
}

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
