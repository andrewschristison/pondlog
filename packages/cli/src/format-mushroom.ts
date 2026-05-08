import type {
  NormalizedMoName,
  NormalizedMoObservation,
  RegionMatch,
} from "@pondlog/source-mushroomobserver";
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

export interface MoObservationWidths {
  taxon: number;
  date: number;
  loc: number;
}

export function computeMoObservationWidths(
  rows: NormalizedMoObservation[],
): MoObservationWidths {
  let taxon = 8;
  let date = 10;
  let loc = 8;
  for (const r of rows) {
    taxon = Math.max(taxon, (r.consensusName ?? "—").length);
    date = Math.max(date, (r.date ?? "—").length);
    loc = Math.max(loc, (r.locationName ?? "—").length);
  }
  return {
    taxon: Math.min(taxon, 30),
    date: Math.min(date, 12),
    loc: Math.min(loc, 50),
  };
}

export function formatMoObservationRow(
  o: NormalizedMoObservation,
  w: MoObservationWidths,
): string {
  const taxon = pc.bold(truncate(o.consensusName ?? "—", w.taxon));
  const date = padEnd(o.date ?? "—", w.date);
  const loc = pc.dim(truncate(o.locationName ?? "—", w.loc));
  const conf =
    typeof o.confidence === "number"
      ? pc.dim(`conf=${padStart(o.confidence.toFixed(2), 5)}`)
      : pc.dim("conf=  —  ");
  const id = pc.dim(`#${o.id}`);
  const img = o.hasImages ? pc.green("📷") : "  ";
  return `  ${padEndVisual(taxon, w.taxon)}  ${date}  ${conf}  ${img}  ${padEndVisual(loc, w.loc)}  ${id}`;
}

export interface MoNameWidths {
  sci: number;
  rank: number;
  classification: number;
}

export function computeMoNameWidths(rows: NormalizedMoName[]): MoNameWidths {
  let sci = 8;
  let rank = 6;
  let classification = 8;
  for (const r of rows) {
    sci = Math.max(sci, r.scientificName.length);
    if (r.rank) rank = Math.max(rank, r.rank.length);
    const c = r.classification.slice(-2).join(" › ");
    classification = Math.max(classification, c.length);
  }
  return {
    sci: Math.min(sci, 36),
    rank: Math.min(rank, 12),
    classification: Math.min(classification, 36),
  };
}

export function formatMoNameRow(
  n: NormalizedMoName,
  w: MoNameWidths,
): string {
  const sci = pc.bold(truncate(n.scientificName, w.sci));
  const rank = pc.dim(padEnd(truncate(n.rank ?? "—", w.rank), w.rank));
  const c = n.classification.slice(-2).join(" › ") || "—";
  const path = pc.dim(truncate(c, w.classification));
  const dep = n.deprecated ? pc.yellow("(deprecated)") : "";
  const id = pc.dim(`#${n.id}`);
  return `  ${padEndVisual(sci, w.sci)}  ${rank}  ${padEndVisual(path, w.classification)}  ${id}${dep ? ` ${dep}` : ""}`;
}

export interface MoRegionWidths {
  name: number;
  count: number;
}

export function computeMoRegionWidths(rows: RegionMatch[]): MoRegionWidths {
  let name = 8;
  let count = 5;
  for (const r of rows) {
    name = Math.max(name, r.name.length);
    count = Math.max(count, String(r.count).length);
  }
  return {
    name: Math.min(name, 70),
    count: Math.min(count, 6),
  };
}

export function formatMoRegionRow(
  r: RegionMatch,
  w: MoRegionWidths,
): string {
  const name = pc.bold(truncate(r.name, w.name));
  const count = pc.dim(`n=${padStart(String(r.count), w.count)}`);
  return `  ${padEndVisual(name, w.name)}  ${count}`;
}

export function formatMoObservationDetail(o: NormalizedMoObservation): string {
  const lines: string[] = [];
  lines.push(pc.bold(o.consensusName ?? "(unidentified)"));
  if (typeof o.confidence === "number") {
    lines.push(pc.dim(`Confidence: ${o.confidence.toFixed(2)}`));
  }
  lines.push(pc.dim(`Date: ${o.date ?? "—"}`));
  lines.push(pc.dim(`Location: ${o.locationName ?? "—"}`));
  if (o.coordinates) {
    const { lat, lng } = o.coordinates;
    const tag = o.gpsHidden ? " (centroid; exact coords hidden)" : "";
    lines.push(pc.dim(`Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}${tag}`));
  }
  if (o.observerLogin) lines.push(pc.dim(`Observer: ${o.observerLogin}`));
  if (o.primaryImageUrl) lines.push(pc.dim(`Image: ${o.primaryImageUrl}`));
  lines.push(pc.dim(`URL: ${o.url}`));
  if (o.notes) {
    lines.push("");
    lines.push(o.notes);
  }
  return lines.join("\n");
}
