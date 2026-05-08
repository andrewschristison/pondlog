import { Command } from "commander";
import {
  getObservation,
  getRecentNearLocation,
  searchNames,
  searchRegions,
  type MoNameRank,
} from "@pondlog/source-mushroomobserver";
import { loadConfig } from "../config.js";
import { printJson } from "../format.js";
import {
  computeMoNameWidths,
  computeMoObservationWidths,
  computeMoRegionWidths,
  formatMoNameRow,
  formatMoObservationDetail,
  formatMoObservationRow,
  formatMoRegionRow,
} from "../format-mushroom.js";
import { resolveLocation } from "../resolve-location.js";
import { parseRadiusKm } from "../validate.js";

const DEFAULT_RADIUS = 25;
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 50;

interface RecentOpts {
  lat?: string;
  lng?: string;
  region?: string;
  radius?: string;
  days?: string;
  limit?: string;
  hasImages?: boolean;
  minConfidence?: string;
  json?: boolean;
}

interface SearchOpts {
  rank?: string;
  json?: boolean;
}

interface RegionsOpts {
  pages?: string;
  json?: boolean;
}

interface ObservationOpts {
  json?: boolean;
}

export function buildMushroomCommand(): Command {
  const cmd = new Command("mushroom").description(
    "Mushroom Observer (mycology) commands — fungi observations and taxonomy from the world's largest mycology platform",
  );

  cmd
    .command("recent")
    .description(
      "Recent fungi observations near a location (last N days). Provide --lat/--lng for a bbox query, or --region for an MO suffix-match query.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option(
      "--region <name>",
      'MO region suffix string (e.g. "Clallam Co., Washington, USA")',
    )
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 500)`)
    .option("-d, --days <n>", `Days back from today (default ${DEFAULT_DAYS}, max 365)`)
    .option("-l, --limit <n>", `Max records (default ${DEFAULT_LIMIT}, max 200)`)
    .option("--has-images", "Only observations with images")
    .option(
      "--min-confidence <n>",
      "Minimum vote-weighted confidence (-3..3). Use 1 to filter out uncertain IDs.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog mushroom recent",
        "  $ pondlog mushroom recent --lat 48.118 --lng -123.4307 --radius 50 --days 60",
        "  $ pondlog mushroom recent --region 'Clallam Co., Washington, USA'",
        "  $ pondlog mushroom recent --has-images --min-confidence 1",
        "",
        "Notes:",
        "  Mushroom Observer uses vote-weighted ID confidence in [-3..3]. A 2.0+",
        "  is a strong consensus. Negative scores mean the consensus is unsure.",
        "  If neither --lat/--lng nor --region is given, falls back to the saved",
        "  default location (or `mushroomObserverRegion` from config).",
      ].join("\n"),
    )
    .action(async (opts: RecentOpts) => {
      const radius = takeRadius(opts.radius);
      const days = takeDays(opts.days);
      const limit = takeLimit(opts.limit);
      const minConfidence = takeMinConfidence(opts.minConfidence);

      const params: Parameters<typeof getRecentNearLocation>[0] = {
        days,
        limit,
      };
      if (minConfidence !== undefined) params.confidenceMin = minConfidence;

      let header = "";
      if (opts.region) {
        params.region = opts.region;
        header = `region: ${opts.region}`;
      } else if (opts.lat || opts.lng) {
        const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
        params.coords = loc.coords;
        params.radiusKm = radius;
        header = `${loc.name ? loc.name + "  ·  " : ""}${loc.coords.lat.toFixed(3)}, ${loc.coords.lng.toFixed(3)}  ·  ${radius} km`;
      } else {
        // No flags — try saved coords, then saved region.
        const cfg = await loadConfig();
        if (cfg.ok && cfg.data?.defaultLocation) {
          const loc = cfg.data.defaultLocation;
          params.coords = { lat: loc.lat, lng: loc.lng };
          params.radiusKm = radius;
          header = `${loc.name ? loc.name + "  ·  " : ""}${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}  ·  ${radius} km`;
        } else if (cfg.ok && cfg.data?.mushroomObserverRegion) {
          params.region = cfg.data.mushroomObserverRegion;
          header = `region: ${cfg.data.mushroomObserverRegion}`;
        } else {
          return fail(
            "no location provided. Pass --lat/--lng, --region, or run `pondlog config set-location` / `pondlog config set-mushroom-region`.",
          );
        }
      }

      const result = await getRecentNearLocation(params);
      if (!result.ok) return fail(result.error.message);

      if (opts.hasImages) {
        result.data.observations = result.data.observations.filter(
          (o) => o.hasImages,
        );
      }

      if (opts.json) return printJson(result.data);

      const records = result.data.observations;
      console.log(`🍄 ${header}  ·  last ${days} days`);
      console.log("");
      if (records.length === 0) {
        console.log(
          `No fungi observations on Mushroom Observer in the last ${days} days. Try --days 90 or a different location.`,
        );
        return;
      }
      const widths = computeMoObservationWidths(records);
      console.log(
        `${result.data.totalRecords} matching record${result.data.totalRecords === 1 ? "" : "s"} on MO${records.length < result.data.totalRecords ? ` (showing ${records.length})` : ""}:`,
      );
      console.log("");
      for (const o of records) console.log(formatMoObservationRow(o, widths));
    });

  cmd
    .command("search <name>")
    .description("Search the Mushroom Observer fungal name index by substring")
    .option(
      "--rank <rank>",
      "Filter to a specific taxonomic rank (Genus, Species, Family, ...)",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog mushroom search Cantharellus",
        "  $ pondlog mushroom search Amanita --rank Genus",
        "  $ pondlog mushroom search 'phalloides' --json",
      ].join("\n"),
    )
    .action(async (queryArg: string, opts: SearchOpts) => {
      const params: Parameters<typeof searchNames>[0] = { query: queryArg };
      if (opts.rank) params.rank = opts.rank as MoNameRank;
      const result = await searchNames(params);
      if (!result.ok) return fail(result.error.message);
      if (opts.json) return printJson(result.data);
      const rows = result.data.names;
      if (rows.length === 0) {
        console.log("No matching names on Mushroom Observer.");
        return;
      }
      const widths = computeMoNameWidths(rows);
      console.log(
        `${result.data.numberOfRecords} name${result.data.numberOfRecords === 1 ? "" : "s"}${rows.length < result.data.numberOfRecords ? ` (showing ${rows.length})` : ""}:`,
      );
      console.log("");
      for (const n of rows) console.log(formatMoNameRow(n, widths));
    });

  cmd
    .command("observation <id>")
    .description("Show a single Mushroom Observer observation in detail")
    .option("--json", "Print raw JSON")
    .action(async (idArg: string, opts: ObservationOpts) => {
      const id = Number(idArg);
      if (!Number.isInteger(id) || id <= 0) {
        return fail(`invalid observation id "${idArg}" — expected a positive integer`);
      }
      const result = await getObservation(id);
      if (!result.ok) return fail(result.error.message);
      if (opts.json) return printJson(result.data);
      console.log(formatMoObservationDetail(result.data));
    });

  cmd
    .command("regions <query>")
    .description(
      'Find Mushroom Observer location names ending in <query> (e.g. "Washington, USA")',
    )
    .option("-p, --pages <n>", "Pages of observations to scan (1..5, default 2)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog mushroom regions 'Clallam Co., Washington, USA'",
        "  $ pondlog mushroom regions 'Washington, USA' --pages 3 --json",
        "",
        "Notes:",
        "  MO's /locations endpoint has no name filter, so this runs an",
        "  observations search with the suffix and aggregates unique location",
        "  names from the results. The count is observations-per-name within",
        "  the scanned pages, not a true global count.",
      ].join("\n"),
    )
    .action(async (queryArg: string, opts: RegionsOpts) => {
      const maxPages = takePages(opts.pages);
      const result = await searchRegions({ query: queryArg, maxPages });
      if (!result.ok) return fail(result.error.message);
      if (opts.json) return printJson(result.data);
      const rows = result.data.regions;
      if (rows.length === 0) {
        console.log(
          `No MO observations matched region "${queryArg}". Try a broader suffix.`,
        );
        return;
      }
      const widths = computeMoRegionWidths(rows);
      console.log(
        `${rows.length} unique location name${rows.length === 1 ? "" : "s"} across ${result.data.pagesScanned} page${result.data.pagesScanned === 1 ? "" : "s"} (${result.data.totalObservations} total observations match the suffix):`,
      );
      console.log("");
      for (const r of rows) console.log(formatMoRegionRow(r, widths));
    });

  return cmd;
}

function takeRadius(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_RADIUS;
  const r = parseRadiusKm(raw);
  if (!r.ok) return fail(r.error.message);
  return r.data;
}

function takeDays(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_DAYS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    return fail(`--days out of range (1..365): ${raw}`);
  }
  return n;
}

function takeLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return fail(`--limit out of range (1..200): ${raw}`);
  }
  return n;
}

function takeMinConfidence(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -3 || n > 3) {
    return fail(`--min-confidence out of range (-3..3): ${raw}`);
  }
  return n;
}

function takePages(raw: string | undefined): number {
  if (raw === undefined) return 2;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return fail(`--pages out of range (1..5): ${raw}`);
  }
  return n;
}

async function takeLocation(flags: { lat?: string; lng?: string }) {
  const loc = await resolveLocation(flags);
  if (!loc.ok) return fail(loc.error.message);
  return loc.data;
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
