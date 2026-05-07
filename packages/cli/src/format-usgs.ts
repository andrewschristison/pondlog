import type {
  NormalizedUsgsReading,
  NormalizedUsgsSeries,
  NormalizedUsgsSiteRecord,
} from "@pondlog/source-usgs";
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

function lastValue(s: NormalizedUsgsSeries): { value: number | undefined; dateTime: string } {
  const v = s.values[s.values.length - 1];
  if (!v) return { value: undefined, dateTime: "" };
  return { value: v.value, dateTime: v.dateTime };
}

function fmtNumber(n: number | undefined): string {
  if (n === undefined) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function fmtIsoLocal(s: string): string {
  if (!s) return "—";
  // /iv/ ships values like "2026-05-07T15:00:00.000-07:00"; trim to "MM-DD HH:MM".
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

export function formatFlowReading(r: NormalizedUsgsReading): string {
  const lines: string[] = [];
  const coords = r.site.coordinates
    ? `${r.site.coordinates.lat.toFixed(3)}, ${r.site.coordinates.lng.toFixed(3)}`
    : "no coords";
  lines.push(
    `${pc.bold(r.site.siteName)}  ${pc.dim(`(USGS ${r.site.siteNumber})`)}`,
  );
  lines.push(`  ${pc.dim(coords)}`);
  for (const s of r.series) {
    const { value, dateTime } = lastValue(s);
    const valueStr = pc.bold(fmtNumber(value));
    const stamp = pc.dim(`@ ${fmtIsoLocal(dateTime)}`);
    const desc = s.variableDescription ?? s.variableName;
    lines.push(
      `  ${pc.dim(`#${s.parameterCode}`)}  ${padEndVisual(truncate(desc, 40), 40)}  ${valueStr} ${pc.dim(s.unitCode)}  ${stamp}`,
    );
  }
  return lines.join("\n");
}

export interface DailyTableWidths {
  date: number;
  value: number;
}

export function computeDailyTableWidths(
  series: NormalizedUsgsSeries,
): DailyTableWidths {
  let value = 6;
  for (const v of series.values) {
    value = Math.max(value, fmtNumber(v.value).length);
  }
  return { date: 12, value: Math.min(value, 10) };
}

export function formatDailyTableHeader(s: NormalizedUsgsSeries): string {
  return pc.bold(
    `  ${padEnd("date", 12)}  ${padStart("value", 10)}  ${pc.dim(s.unitCode)}  ${pc.dim(s.statistic ?? "")}`.trimEnd(),
  );
}

export function formatDailyRow(
  v: { dateTime: string; value: number | undefined; qualifiers: string[] },
  w: DailyTableWidths,
): string {
  const date = v.dateTime.slice(0, 10);
  const value = padStart(fmtNumber(v.value), w.value);
  const qual = v.qualifiers.length > 0 ? pc.dim(`[${v.qualifiers.join(",")}]`) : "";
  return `  ${padEnd(date, w.date)}  ${value}  ${qual}`.trimEnd();
}

export interface SiteTableWidths {
  site: number;
  name: number;
}

export function computeSiteTableWidths(
  rows: NormalizedUsgsSiteRecord[],
): SiteTableWidths {
  let name = 8;
  for (const r of rows) name = Math.max(name, r.siteName.length);
  return { site: 14, name: Math.min(name, 50) };
}

export function formatSiteRow(
  r: NormalizedUsgsSiteRecord,
  w: SiteTableWidths,
): string {
  const id = pc.dim(padEnd(r.siteNumber, w.site));
  const name = pc.bold(truncate(r.siteName, w.name));
  const coords = r.coordinates
    ? pc.dim(
        `(${r.coordinates.lat.toFixed(3)}, ${r.coordinates.lng.toFixed(3)})`,
      )
    : pc.dim("(no coords)");
  return `  ${id}  ${padEndVisual(name, w.name)}  ${coords}`;
}
