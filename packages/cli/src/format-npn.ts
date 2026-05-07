import type {
  ActivePhenologyEntry,
  ActivePhenologyResult,
} from "@pondlog/source-npn";
import type { Taxon } from "@pondlog/core";
import pc from "picocolors";

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function padStart(s: string, width: number): string {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}

function visualLength(s: string): number {
  return s.replace(/\[[0-9;]*m/g, "").length;
}

function padEndVisual(s: string, width: number): string {
  const len = visualLength(s);
  return len >= width ? s : s + " ".repeat(width - len);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export interface ActivePhenologyWidths {
  common: number;
  sci: number;
  pheno: number;
  date: number;
}

export function computeActivePhenologyWidths(
  rows: ActivePhenologyEntry[],
): ActivePhenologyWidths {
  let common = 8;
  let sci = 8;
  let pheno = 8;
  let date = 10;
  for (const r of rows) {
    common = Math.max(common, r.commonName.length);
    sci = Math.max(sci, r.taxonName.length);
    if (r.phenophaseDescription) {
      pheno = Math.max(pheno, r.phenophaseDescription.length);
    }
    if (r.meanLastYesDate) {
      date = Math.max(date, r.meanLastYesDate.length);
    }
  }
  return {
    common: Math.min(common, 30),
    sci: Math.min(sci, 30),
    pheno: Math.min(pheno, 36),
    date: Math.min(date, 12),
  };
}

export function formatActivePhenologyRow(
  e: ActivePhenologyEntry,
  w: ActivePhenologyWidths,
): string {
  const common = pc.bold(truncate(e.commonName, w.common));
  const sci = pc.dim(truncate(e.taxonName, w.sci));
  const pheno = truncate(e.phenophaseDescription ?? "—", w.pheno);
  const date = padEnd(e.meanLastYesDate ?? "—", w.date);
  const dist = pc.dim(`${e.distanceKm.toFixed(1)} km`);
  const n = e.lastYesSampleSize ?? 0;
  const sample = pc.dim(`n=${padStart(String(n), 2)}`);
  return `  ${padEndVisual(common, w.common)}  ${padEndVisual(sci, w.sci)}  ${padEndVisual(pheno, w.pheno)}  ${date}  ${sample}  ${dist}`;
}

export function formatActivePhenologyHeader(r: ActivePhenologyResult): string {
  const place = `${r.coordinates.lat.toFixed(3)}, ${r.coordinates.lng.toFixed(3)}`;
  const stations =
    r.stationsSearched < r.stationsInRadius
      ? `${r.stationsSearched}/${r.stationsInRadius} closest stations (capped)`
      : `${r.stationsSearched} stations`;
  return pc.bold(
    `${place}  ·  ${r.radiusKm} km  ·  last ${r.yearsBack} year${r.yearsBack === 1 ? "" : "s"}  ·  ${stations}`,
  );
}

export interface NpnSpeciesWidths {
  common: number;
  sci: number;
}

export function computeNpnSpeciesWidths(rows: Taxon[]): NpnSpeciesWidths {
  let common = 8;
  let sci = 8;
  for (const r of rows) {
    common = Math.max(common, r.commonName.length);
    sci = Math.max(sci, r.name.length);
  }
  return {
    common: Math.min(common, 36),
    sci: Math.min(sci, 36),
  };
}

export function formatNpnSpeciesRow(t: Taxon, w: NpnSpeciesWidths): string {
  const common = pc.bold(truncate(t.commonName, w.common));
  const sci = pc.dim(truncate(t.name, w.sci));
  const id = pc.dim(`#${t.id}`);
  const kingdom = pc.dim(t.iconicTaxon === "Unknown" ? "" : t.iconicTaxon);
  const trail = kingdom ? `  ${kingdom}` : "";
  return `  ${padEndVisual(common, w.common)}  ${padEndVisual(sci, w.sci)}  ${id}${trail}`;
}
