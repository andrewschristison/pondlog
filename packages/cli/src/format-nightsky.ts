import type {
  ConstellationVisibility,
  DarkSkyWindow,
  MeteorShower,
  MoonPhase,
  NightSkyBriefing,
  PlanetPosition,
  SunTimes,
} from "@pondlog/source-nightsky";
import pc from "picocolors";

function visualLength(s: string): number {
  return s.replace(/\[[0-9;]*m/g, "").length;
}

function padEndVisual(s: string, width: number): string {
  const len = visualLength(s);
  return len >= width ? s : s + " ".repeat(width - len);
}

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function localTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function localDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stars(quality: 1 | 2 | 3 | 4 | 5): string {
  return "★".repeat(quality) + "☆".repeat(5 - quality);
}

export function formatBriefingHeader(b: NightSkyBriefing): string {
  const place = `${b.coordinates.lat.toFixed(3)}, ${b.coordinates.lng.toFixed(3)}`;
  return pc.bold(`${place}  ·  ${localDate(b.date)}`);
}

export function formatSunTimes(sun: SunTimes): string {
  const lines: string[] = [];
  lines.push(
    `  Sunrise        ${localTime(sun.sunrise)}    ${pc.dim(`Sunset         ${localTime(sun.sunset)}`)}`,
  );
  lines.push(
    `  Civil dawn     ${localTime(sun.civilDawn)}    ${pc.dim(`Civil dusk     ${localTime(sun.civilDusk)}`)}`,
  );
  lines.push(
    `  Nautical dawn  ${localTime(sun.nauticalDawn)}    ${pc.dim(`Nautical dusk  ${localTime(sun.nauticalDusk)}`)}`,
  );
  lines.push(
    `  Astro dawn     ${localTime(sun.astronomicalDawn)}    ${pc.dim(`Astro dusk     ${localTime(sun.astronomicalDusk)}`)}`,
  );
  return lines.join("\n");
}

export function formatMoonLine(moon: MoonPhase): string {
  const pct = `${(moon.illuminationFraction * 100).toFixed(0)}% illuminated`;
  const age = `${moon.ageDays.toFixed(1)} d old`;
  const rs = moon.rise || moon.set
    ? pc.dim(
        `  rise ${localTime(moon.rise)}  set ${localTime(moon.set)}`,
      )
    : "";
  return `  ${moon.emoji}  ${pc.bold(moon.phase)}  ${pc.dim(`(${pct} · ${age})`)}${rs}`;
}

export function formatDarkSkyLine(d: DarkSkyWindow): string {
  const window =
    d.start && d.end
      ? `${localTime(d.start)} → ${localTime(d.end)}  (${d.hours.toFixed(1)} h)`
      : pc.dim("no astronomical dark tonight");
  const moonNote =
    d.moonAltAtMid > 0
      ? pc.dim(
          `  moon ${d.moonAltAtMid.toFixed(0)}° up · ${(d.moonIlluminationAtMid * 100).toFixed(0)}%`,
        )
      : pc.dim(`  moon below horizon`);
  return `  ${stars(d.quality)}  ${pc.bold(d.qualityLabel)}  ${pc.dim("·")}  ${window}${moonNote}`;
}

export function formatPlanetRow(p: PlanetPosition): string {
  const name = pc.bold(padEnd(p.name, 8));
  const dir = padEnd(p.direction, 4);
  const alt = padEnd(`${p.altitudeDeg.toFixed(0)}°`, 4);
  const mag = `mag ${p.magnitude >= 0 ? "+" : ""}${p.magnitude.toFixed(1)}`;
  const hint = p.highlight ? pc.dim(` — ${p.highlight}`) : "";
  return `  ${name}  ${pc.dim(dir)}  ${pc.dim(alt)}  ${pc.dim(mag)}${hint}`;
}

export function formatPlanetsTable(planets: PlanetPosition[]): string {
  if (planets.length === 0) {
    return pc.dim("  (no planets above 5° altitude during dark)");
  }
  return planets.map(formatPlanetRow).join("\n");
}

export function formatShowerRow(s: MeteorShower): string {
  const name = pc.bold(padEnd(s.name, 22));
  const peak =
    s.daysToPeak === 0
      ? pc.green("peaks tonight")
      : s.daysToPeak < 0
        ? pc.dim(`peaked ${Math.abs(s.daysToPeak)}d ago`)
        : pc.dim(`peaks in ${s.daysToPeak}d`);
  const zhr = pc.dim(`ZHR ${s.zhr}`);
  const moon = pc.dim(`moon: ${s.moonInterference}`);
  return `  ${name}  ${padEndVisual(peak, 18)}  ${padEnd(zhr, 10)}  ${moon}`;
}

export function formatShowerList(showers: MeteorShower[]): string {
  if (showers.length === 0) {
    return pc.dim("  (none)");
  }
  return showers.map(formatShowerRow).join("\n");
}

export function formatConstellationRow(c: ConstellationVisibility): string {
  const name = pc.bold(padEnd(c.name, 14));
  const dir = padEnd(c.direction, 4);
  const alt = padEnd(`${c.altitudeDeg.toFixed(0)}°`, 4);
  const seasonTag = c.isInSeason ? pc.green("●") : pc.dim("○");
  const stars = pc.dim(c.notableStars.slice(0, 3).join(", "));
  return `  ${seasonTag} ${name}  ${pc.dim(dir)}  ${pc.dim(alt)}  ${stars}`;
}

export function formatConstellationList(
  rows: ConstellationVisibility[],
): string {
  if (rows.length === 0) {
    return pc.dim("  (none above 15°)");
  }
  return rows.map(formatConstellationRow).join("\n");
}
