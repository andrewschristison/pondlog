import {
  findCrop,
  getBestCompanions,
  type FungiObservation,
  type GardenBriefing,
  type NatureBriefing,
  type Observation,
  type PhenologyEntry,
  type StreamflowReading,
  type TideEvent,
} from "@pondlog/core";
import { Command } from "commander";
import pc from "picocolors";
import { buildTodayBriefing } from "../aggregate.js";
import { loadConfig } from "../config.js";
import { printJson } from "../format.js";
import { resolveLocation, type ResolvedLocation } from "../resolve-location.js";

interface TodayOpts {
  lat?: string;
  lng?: string;
  date?: string;
  json?: boolean;
  /** Commander maps `--no-cache` to `cache: false` (default true). */
  cache?: boolean;
}

export function buildTodayCommand(): Command {
  const cmd = new Command("today")
    .description(
      "Unified nature briefing for a location: sun/moon/dark-sky/tides/streamflow/wildlife/phenology.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print the full NatureBriefing as JSON")
    .option("--no-cache", "Bypass on-disk cache and re-fetch every source")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog today",
        "  $ pondlog today --lat 48.118 --lng -123.4307",
        "  $ pondlog today --json | jq '.nightSky.darkSky'",
        "  $ pondlog today --no-cache",
        "",
        "Configure default stations/sites for richer output:",
        "  $ pondlog config set-station 9444090       # NOAA tides",
        "  $ pondlog config set-usgs-site 12045500    # USGS streamflow",
        "  $ pondlog config set-ebird-region US-WA-009",
      ].join("\n"),
    )
    .action(async (opts: TodayOpts) => {
      const cfgRes = await loadConfig();
      if (!cfgRes.ok) return fail(cfgRes.error.message);
      const loc = await resolveLocation({ lat: opts.lat, lng: opts.lng });
      if (!loc.ok) return fail(loc.error.message);

      const dateRes = parseOptionalDate(opts.date);
      if (!dateRes.ok) return fail(dateRes.error);

      const buildParams: Parameters<typeof buildTodayBriefing>[0] = {
        coords: loc.data.coords,
        config: cfgRes.data,
        noCache: opts.cache === false,
      };
      if (dateRes.value !== undefined) {
        buildParams.date = dateRes.value;
      }
      const { briefing, cacheHits } = await buildTodayBriefing(buildParams);

      if (opts.json) {
        printJson({ ...briefing, cacheHits });
        return;
      }

      renderBriefing(briefing, loc.data, cacheHits);
    });

  return cmd;
}

function renderBriefing(
  b: NatureBriefing,
  loc: ResolvedLocation,
  cacheHits: Record<string, boolean>,
): void {
  const place = loc.name
    ? `${loc.name} (${b.coordinates.lat.toFixed(3)}, ${b.coordinates.lng.toFixed(3)})`
    : `${b.coordinates.lat.toFixed(3)}, ${b.coordinates.lng.toFixed(3)}`;
  const generated = new Date(b.generatedAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  console.log(pc.bold(`${place}  ·  ${generated}`));
  console.log("");

  if (b.nightSky) {
    const sun = b.nightSky.sun;
    const moon = b.nightSky.moon;
    console.log(
      `  ☀  Sunrise ${localTime(sun.sunrise)}  ·  Sunset ${localTime(sun.sunset)}`,
    );
    const moonPct = `${(moon.illuminationFraction * 100).toFixed(0)}%`;
    const moonRiseSet =
      moon.set || moon.rise
        ? pc.dim(
            `  rise ${localTime(moon.rise)}  set ${localTime(moon.set)}`,
          )
        : "";
    console.log(`  ${moon.emoji}  ${moon.phase}  ${pc.dim(`(${moonPct})`)}${moonRiseSet}`);
    const dark = b.nightSky.darkSky;
    const darkLine =
      dark.start && dark.end
        ? `Dark sky ${dark.qualityLabel} (${dark.quality}/5)  ${localTime(dark.start)}–${localTime(dark.end)}`
        : `Dark sky ${dark.qualityLabel} (${dark.quality}/5)  ${pc.dim("no astronomical dark tonight")}`;
    console.log(`  ⭐  ${darkLine}`);
    const visiblePlanets = b.nightSky.visiblePlanets;
    if (visiblePlanets.length > 0) {
      const list = visiblePlanets
        .slice(0, 3)
        .map((p) => `${p.name} ${p.direction} mag ${p.magnitude >= 0 ? "+" : ""}${p.magnitude.toFixed(1)}`)
        .join(", ");
      console.log(`     ${pc.dim(`Visible: ${list}`)}`);
    }
    console.log("");
  }

  if (b.tides) {
    console.log(pc.bold("Tides"));
    const merged = mergeTides(b.tides.high, b.tides.low);
    if (merged.length === 0) {
      console.log(pc.dim("  (no events for today)"));
    } else {
      for (const ev of merged.slice(0, 4)) {
        const label = ev.type === "high" ? "High" : "Low";
        console.log(
          `  🌊  ${pc.bold(label.padEnd(5))} ${ev.heightFt.toFixed(1).padStart(5)} ft  ${pc.dim(localTime(ev.time))}`,
        );
      }
    }
    cacheTag(cacheHits.noaa, "noaa");
    console.log("");
  }

  if (b.streamflow) {
    renderStreamflow(b.streamflow);
    cacheTag(cacheHits.usgs, "usgs");
    console.log("");
  }

  renderObservations(b.recentObservations, cacheHits);
  if (b.recentObservations.length > 0) console.log("");

  if (b.phenology && b.phenology.length > 0) {
    renderPhenology(b.phenology);
    cacheTag(cacheHits.npn, "npn");
    console.log("");
  }

  if (b.fungi && b.fungi.length > 0) {
    renderFungi(b.fungi);
    cacheTag(cacheHits.mushroomobserver, "mushroomobserver");
    console.log("");
  }

  if (b.garden) {
    renderGarden(b.garden);
    console.log("");
  }

  if (b.errors.length > 0) {
    console.log(pc.yellow(pc.bold("⚠  Partial failures")));
    for (const e of b.errors) {
      console.log(pc.yellow(`  ${e.source}: ${e.message}`));
    }
  }
}

function renderStreamflow(s: StreamflowReading): void {
  console.log(pc.bold("Streamflow"));
  const flow = s.flowCfs !== undefined ? `${formatNumber(s.flowCfs)} cfs` : "—";
  const height = s.gageHeightFt !== undefined ? `${s.gageHeightFt.toFixed(2)} ft` : "—";
  console.log(`  💧  ${pc.bold(s.siteName)}  ${flow}  ${pc.dim(`gage ${height}`)}`);
}

function renderObservations(
  observations: Observation[],
  cacheHits: Record<string, boolean>,
): void {
  if (observations.length === 0) return;
  const birds = observations.filter((o) => o.iconicTaxon === "Aves");
  const others = observations.filter((o) => o.iconicTaxon !== "Aves");

  if (birds.length > 0) {
    const uniqueNames = unique(birds.map((b) => b.commonName).filter(Boolean));
    const sample = uniqueNames.slice(0, 5).join(", ");
    console.log(
      `🐦  ${pc.bold(`${birds.length} bird obs`)} (${uniqueNames.length} species)`,
    );
    if (sample) console.log(`     ${pc.dim(sample)}`);
    cacheTag(cacheHits.ebird, "ebird");
  }
  if (others.length > 0) {
    const uniqueNames = unique(
      others.map((o) => o.commonName || o.taxonName).filter(Boolean),
    );
    const sample = uniqueNames.slice(0, 5).join(", ");
    console.log(`🦋  ${pc.bold(`${others.length} other obs`)} (${uniqueNames.length} species)`);
    if (sample) console.log(`     ${pc.dim(sample)}`);
    cacheTag(cacheHits.inaturalist, "inaturalist");
  }
}

function renderFungi(entries: FungiObservation[]): void {
  console.log(pc.bold("Fungi"));
  // Sort by most recent date desc, then by descending confidence.
  const sorted = [...entries].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
  const top = sorted.slice(0, 4);
  for (const f of top) {
    const date = f.date ? pc.dim(f.date) : "";
    const conf =
      typeof f.confidence === "number"
        ? pc.dim(`conf=${f.confidence.toFixed(2)}`)
        : "";
    const dist =
      typeof f.distanceKm === "number"
        ? pc.dim(`${f.distanceKm.toFixed(1)} km`)
        : f.locationName
          ? pc.dim(f.locationName.split(",")[0] ?? "")
          : "";
    const img = f.hasImages ? "📷  " : "";
    const meta = [date, conf, dist].filter(Boolean).join("  ·  ");
    console.log(
      `  🍄  ${img}${pc.bold(f.consensusName)}${meta ? `  ${pc.dim("·")}  ${meta}` : ""}`,
    );
  }
  if (entries.length > top.length) {
    console.log(pc.dim(`  …and ${entries.length - top.length} more`));
  }
}

function renderGarden(g: GardenBriefing): void {
  console.log(
    pc.bold(`🌱 Garden — zone ${g.zone.zone}`) +
      pc.dim(
        `  ·  ${g.zone.minTempF}-${g.zone.maxTempF}°F  ·  frost ~${g.frostDates.lastSpring}…~${g.frostDates.firstFall}  (${g.frostDates.seasonDays}d season)`,
      ),
  );
  if (g.plantNow.length === 0) {
    console.log(
      pc.dim(`  Nothing in window today. \`pondlog garden zone\` for full details.`),
    );
    return;
  }
  const top = g.plantNow.slice(0, 5);
  const actionIcon: Record<string, string> = {
    start_indoors: "🪴",
    direct_sow: "🌱",
    transplant: "🌿",
    plant_now: "🌳",
  };
  const actionLabel: Record<string, string> = {
    start_indoors: "start indoors",
    direct_sow: "direct sow",
    transplant: "transplant",
    plant_now: "plant now",
  };
  for (const s of top) {
    const action = pc.cyan(actionLabel[s.action] ?? s.action);
    const window = pc.dim(`window ${s.windowStart}…${s.windowEnd}`);
    console.log(
      `  ${actionIcon[s.action] ?? "·"}  ${pc.bold(s.commonName)} — ${action}  ${window}`,
    );
    const partner = topStrongCompanion(s.slug);
    if (partner) {
      console.log(pc.dim(`     ↳ pairs well with ${partner}`));
    }
  }
  if (g.plantNow.length > top.length) {
    console.log(
      pc.dim(`  …and ${g.plantNow.length - top.length} more — \`pondlog garden now\` for full list`),
    );
  }
}

function renderPhenology(entries: PhenologyEntry[]): void {
  console.log(pc.bold("Phenology"));
  const sample = entries.slice(0, 4);
  for (const p of sample) {
    const distance = p.distanceKm !== undefined ? pc.dim(`  ${p.distanceKm} km`) : "";
    const days =
      p.daysSinceLastYes !== undefined
        ? pc.dim(`  ${p.daysSinceLastYes}d since last 'yes'`)
        : "";
    console.log(`  🌿  ${pc.bold(p.species)} — ${p.phenophase}${distance}${days}`);
  }
  if (entries.length > sample.length) {
    console.log(pc.dim(`  …and ${entries.length - sample.length} more`));
  }
}

function cacheTag(hit: boolean | undefined, _source: string): void {
  if (hit === true) {
    process.stdout.write(pc.dim(pc.italic("     (cached)\n")));
  }
}

function localTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mergeTides(
  high: TideEvent[],
  low: TideEvent[],
): TideEvent[] {
  return [...high, ...low].sort((a, b) => a.time.localeCompare(b.time));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 10_000) return n.toLocaleString();
  if (Math.abs(n) >= 100) return n.toFixed(0);
  return n.toFixed(1);
}

function parseOptionalDate(input: string | undefined): { ok: true; value: Date | undefined } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, value: undefined };
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `invalid --date "${input}" — expected ISO 8601 (e.g. 2026-05-07 or 2026-05-07T20:00:00Z)` };
  }
  return { ok: true, value: d };
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}

/** Top strong-grade beneficial companion for a planted crop, used as the
 *  one-line "pairs well with X" hint under each plantNow entry. Returns
 *  undefined when no strong companion is in the fixture for this crop. */
function topStrongCompanion(slug: string): string | undefined {
  const best = getBestCompanions(slug, { minStrength: "strong", limit: 1 });
  const top = best[0];
  if (!top) return undefined;
  return findCrop(top.companion)?.commonName ?? top.companion;
}
