import type {
  EbirdChecklistDetail,
  EbirdHotspot,
  EbirdObservation,
} from "@pondlog/source-ebird";
import pc from "picocolors";
import { formatRelativeDate } from "./format.js";

export interface EbirdObsRowWidths {
  common: number;
  sci: number;
  loc: number;
  rel: number;
}

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

export function computeEbirdObsWidths(rows: EbirdObservation[]): EbirdObsRowWidths {
  let common = 8;
  let sci = 8;
  let loc = 8;
  let rel = 8;
  for (const r of rows) {
    common = Math.max(common, r.comName.length);
    sci = Math.max(sci, r.sciName.length);
    loc = Math.max(loc, r.locName.length);
    rel = Math.max(rel, formatRelativeDate(r.obsDt).length);
  }
  return {
    common: Math.min(common, 32),
    sci: Math.min(sci, 32),
    loc: Math.min(loc, 32),
    rel: Math.min(rel, 14),
  };
}

export function formatEbirdObs(
  obs: EbirdObservation,
  w: EbirdObsRowWidths,
  opts: { notable?: boolean } = {},
): string {
  const marker = opts.notable ? pc.yellow("★") : " ";
  const howMany = obs.howMany === null || obs.howMany === undefined ? "—" : String(obs.howMany);
  const count = padStart(howMany, 4);
  const common = pc.bold(truncate(obs.comName, w.common));
  const sci = pc.dim(truncate(obs.sciName, w.sci));
  const loc = pc.dim(truncate(obs.locName, w.loc));
  const rel = padEnd(formatRelativeDate(obs.obsDt), w.rel);
  return `  ${marker} ${count}  ${padEndVisual(common, w.common)}  ${padEndVisual(sci, w.sci)}  ${padEndVisual(loc, w.loc)}  ${rel}`;
}

export interface FormattedHotspotWidths {
  name: number;
  count: number;
}

export function computeHotspotWidths(rows: EbirdHotspot[]): FormattedHotspotWidths {
  let name = 8;
  let count = 4;
  for (const r of rows) {
    name = Math.max(name, r.locName.length);
    if (typeof r.numSpeciesAllTime === "number") {
      count = Math.max(count, String(r.numSpeciesAllTime).length);
    }
  }
  return {
    name: Math.min(name, 40),
    count: Math.min(count, 6),
  };
}

export function formatHotspot(h: EbirdHotspot, w: FormattedHotspotWidths): string {
  const name = pc.bold(truncate(h.locName, w.name));
  const species = h.numSpeciesAllTime === null || h.numSpeciesAllTime === undefined
    ? "—"
    : String(h.numSpeciesAllTime);
  const speciesPad = padStart(species, w.count);
  const lastObs = h.latestObsDt
    ? formatRelativeDate(h.latestObsDt)
    : pc.dim("never");
  const coords = pc.dim(`(${h.lat.toFixed(3)}, ${h.lng.toFixed(3)})`);
  return `  ${padEndVisual(name, w.name)}  ${pc.dim(`${speciesPad} spp`)}  last: ${lastObs}  ${coords}`;
}

export function formatChecklistHeader(c: EbirdChecklistDetail): string {
  const lines: string[] = [];
  lines.push(pc.bold(`Checklist ${c.subId}`));
  const meta: string[] = [];
  if (c.userDisplayName) meta.push(c.userDisplayName);
  meta.push(c.obsDt);
  if (typeof c.numSpecies === "number") meta.push(`${c.numSpecies} species`);
  if (typeof c.durationHrs === "number") meta.push(`${c.durationHrs.toFixed(2)} hrs`);
  if (typeof c.effortDistanceKm === "number") meta.push(`${c.effortDistanceKm.toFixed(2)} km`);
  if (typeof c.numObservers === "number") meta.push(`${c.numObservers} observer${c.numObservers === 1 ? "" : "s"}`);
  lines.push(pc.dim(meta.join("  ·  ")));
  lines.push(pc.dim(`https://ebird.org/checklist/${c.subId}`));
  return lines.join("\n");
}

export function groupObsByLocation(obs: EbirdObservation[]): Map<string, EbirdObservation[]> {
  const map = new Map<string, EbirdObservation[]>();
  for (const o of obs) {
    const list = map.get(o.locName) ?? [];
    list.push(o);
    map.set(o.locName, list);
  }
  return new Map(
    [...map.entries()].sort((a, b) => b[1].length - a[1].length),
  );
}
